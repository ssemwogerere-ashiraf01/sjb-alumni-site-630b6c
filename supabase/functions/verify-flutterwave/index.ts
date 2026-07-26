// =========================================================================
// verify-flutterwave Edge Function
// Deploy with: supabase functions deploy verify-flutterwave
// Secrets needed: FLUTTERWAVE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
//
// Why this has to exist server-side: Flutterwave's inline checkout calls
// a JS `callback` in the browser when it *thinks* payment succeeded, but
// that callback can be faked from devtools by anyone. The only trustworthy
// confirmation is asking Flutterwave's API directly, with your secret key,
// whether that specific transaction really settled — which must happen
// somewhere the secret key is safe, i.e. never in frontend JS.
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FLW_SECRET_KEY = Deno.env.get('FLUTTERWAVE_SECRET_KEY')!;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*', // tighten to your real domain in production
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing auth token.' }, 401, cors);

    // Client must be logged in — we identify the user from their JWT,
    // never trust a user_id sent in the request body.
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Invalid session.' }, 401, cors);

    const { tx_ref, kind, group_id, month_year } = await req.json();
    // kind: 'membership' | 'savings'
    if (!tx_ref || !kind) return json({ error: 'tx_ref and kind are required.' }, 400, cors);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Ask Flutterwave directly — the only source of truth
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`,
      { headers: { Authorization: `Bearer ${FLW_SECRET_KEY}` } }
    );
    const flwData = await flwRes.json();
    const txn = flwData?.data;

    const isVerified =
      flwRes.ok &&
      txn?.status === 'successful' &&
      txn?.tx_ref === tx_ref &&
      txn?.customer?.email?.toLowerCase() === user.email?.toLowerCase();

    if (!isVerified) {
      await admin.from('audit_log').insert({
        actor_id: user.id, action: 'payment_verification_failed',
        details: { tx_ref, flw_status: txn?.status ?? 'unknown', flw_http_status: flwRes.status, flw_message: flwData?.message },
      });
      // Surface WHY it failed (no secrets involved) so this is diagnosable
      // from the browser instead of guessing blind next time.
      let reason = 'Unknown error.';
      if (!FLW_SECRET_KEY) reason = 'Server is missing its Flutterwave secret key configuration.';
      else if (flwRes.status === 401) reason = 'Flutterwave rejected the secret key (401 Unauthorized) — check it matches Test/Live mode correctly.';
      else if (!flwRes.ok) reason = `Flutterwave API returned HTTP ${flwRes.status}: ${flwData?.message ?? 'no message'}.`;
      else if (!txn) reason = 'No transaction found for this reference yet — it may still be processing.';
      else if (txn.status !== 'successful') reason = `Transaction status is "${txn.status}", not "successful".`;
      else if (txn.customer?.email?.toLowerCase() !== user.email?.toLowerCase()) reason = 'Transaction email does not match your account email.';

      return json({ error: `Payment could not be verified. (${reason})` }, 402, cors);
    }

    if (kind === 'membership') {
      // Confirm the amount roughly matches the member's fee tier before trusting it.
      const { data: profileRow } = await admin.from('profiles').select('membership_class').eq('id', user.id).single();
      const feeKey = profileRow?.membership_class === 'alumni' ? 'membership_fee_alumni' : 'membership_fee_non_alumni';
      const { data: settings } = await admin.from('app_settings').select('value').eq('key', feeKey).single();
      const expected = settings?.value?.amount ?? (profileRow?.membership_class === 'alumni' ? 3000 : 15000);
      if (txn.currency === 'UGX' && Number(txn.amount) < expected * 0.98) {
        return json({ error: 'Amount paid does not match your membership fee tier.' }, 402, cors);
      }

      await admin.from('payments').update({
        status: 'completed',
        flw_transaction_id: String(txn.id),
        raw_response: txn,
        verified_at: new Date().toISOString(),
      }).eq('tx_ref', tx_ref).eq('user_id', user.id);

      await admin.from('profiles').update({
        membership_fee_paid: true,
        membership_fee_paid_at: new Date().toISOString(),
      }).eq('id', user.id);

      await admin.from('audit_log').insert({
        actor_id: user.id, action: 'membership_fee_paid', target_table: 'profiles', target_id: user.id,
        details: { tx_ref, amount: txn.amount, currency: txn.currency },
      });

      return json({ success: true }, 200, cors);
    }

    if (kind === 'savings_join_fee') {
      if (!group_id) return json({ error: 'group_id is required.' }, 400, cors);

      const { data: group } = await admin.from('savings_groups').select('group_join_fee').eq('id', group_id).single();
      const expected = group?.group_join_fee ?? 3000;
      if (txn.currency === 'UGX' && Number(txn.amount) < expected * 0.98) {
        return json({ error: 'Amount paid does not match the group join fee.' }, 402, cors);
      }

      // Fee paid is confirmed, but activation (a sensitive status change)
      // still requires admin approval — matches "only admins edit sensitive info."
      await admin.from('savings_group_members').update({
        join_fee_paid: true,
        join_fee_paid_at: new Date().toISOString(),
      }).eq('group_id', group_id).eq('user_id', user.id);

      await admin.from('audit_log').insert({
        actor_id: user.id, action: 'savings_join_fee_paid', target_table: 'savings_group_members',
        details: { tx_ref, group_id, amount: txn.amount },
      });

      return json({ success: true, note: 'Join fee confirmed. An admin will activate your membership shortly.' }, 200, cors);
    }

    if (kind === 'savings') {
      if (!group_id || !month_year) return json({ error: 'group_id and month_year are required for savings.' }, 400, cors);

      await admin.from('savings_transactions').update({
        status: 'completed',
        approved_at: new Date().toISOString(),
      }).eq('tx_ref', tx_ref).eq('user_id', user.id);

      await admin.from('audit_log').insert({
        actor_id: user.id, action: 'savings_contribution_verified', target_table: 'savings_transactions',
        details: { tx_ref, group_id, month_year, amount: txn.amount },
      });

      return json({ success: true }, 200, cors);
    }

    return json({ error: 'Unknown payment kind.' }, 400, cors);
  } catch (e) {
    return json({ error: 'Unexpected error verifying payment.' }, 500, cors);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}
