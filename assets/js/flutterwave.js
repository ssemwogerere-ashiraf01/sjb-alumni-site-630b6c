import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';

const VERIFY_URL = 'https://azqixcnkhkzebufenbpx.supabase.co/functions/v1/verify-flutterwave';
const FLW_PUBLIC_KEY = 'FLWPUBK_TEST-361c473981b702b6fd43bf310c9be55c-X'; // swap for your live public key in production

function genTxRef(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

async function verifyWithServer({ tx_ref, kind, group_id, month_year }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(VERIFY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ tx_ref, kind, group_id, month_year }),
  });
  return await res.json();
}

// Live UGX -> USD rate for members who want to pay in dollars. Falls back
// to a fixed approximate rate if the lookup fails, so checkout never blocks.
async function getUgxToUsdRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/UGX');
    const data = await res.json();
    return data?.rates?.USD ?? 0.00027;
  } catch {
    return 0.00027; // approximate fallback
  }
}

export async function paySavingsJoinFee(group) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = `${BASE_URL}/login.html`; return; }

  const tx_ref = genTxRef('JOINFEE');

  // Create (or reuse) the pending membership row before checkout.
  const { error: insertErr } = await supabase.from('savings_group_members').upsert({
    group_id: group.id, user_id: user.id, status: 'pending',
  }, { onConflict: 'group_id,user_id', ignoreDuplicates: true });
  if (insertErr) { alert('Could not start registration: ' + insertErr.message); return; }

  FlutterwaveCheckout({
    public_key: FLW_PUBLIC_KEY,
    tx_ref,
    amount: group.group_join_fee,
    currency: 'UGX',
    payment_options: 'card, mobilemoneyuganda',
    customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
    customizations: {
      title: `${group.name} — Group Join Fee`,
      description: 'One-time savings group registration fee',
      logo: 'https://www.flutterwave.com/images/logo/logo-mark.svg',
    },
    callback: async function () {
      const result = await verifyWithServer({ tx_ref, kind: 'savings_join_fee', group_id: group.id });
      if (result.success) {
        window.location.href = `${BASE_URL}/savings/register.html?paid=1`;
      } else {
        alert(result.error || 'We could not confirm your payment yet. Reference: ' + tx_ref);
      }
    },
    onclose: function () {
      verifyWithServer({ tx_ref, kind: 'savings_join_fee', group_id: group.id }).then((r) => {
        if (r.success) window.location.href = `${BASE_URL}/savings/register.html?paid=1`;
      });
    },
  });
}

export async function payMembershipFee({ currency = 'UGX' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = `${BASE_URL}/login.html`; return; }

  const { data: profile } = await supabase.from('profiles').select('membership_class').eq('id', user.id).single();
  const feeKey = profile?.membership_class === 'alumni' ? 'membership_fee_alumni' : 'membership_fee_non_alumni';
  const { data: settings } = await supabase.from('app_settings').select('value').eq('key', feeKey).single();
  const feeUgx = settings?.value?.amount ?? (profile?.membership_class === 'alumni' ? 3000 : 15000);

  let amount = feeUgx;
  if (currency === 'USD') {
    const rate = await getUgxToUsdRate();
    amount = Math.ceil(feeUgx * rate * 100) / 100; // round up to cents
  }

  const tx_ref = genTxRef('MEMFEE');

  // Record intent BEFORE opening checkout — RLS only allows inserting
  // your own row with status 'pending', so this can't be faked as paid.
  const { error: insertErr } = await supabase.from('payments').insert({
    user_id: user.id, purpose: 'membership_fee', amount, currency, tx_ref, status: 'pending',
  });
  if (insertErr) { alert('Could not start payment: ' + insertErr.message); return; }

  FlutterwaveCheckout({
    public_key: FLW_PUBLIC_KEY,
    tx_ref,
    amount,
    currency,
    payment_options: 'card, mobilemoneyuganda',
    customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
    customizations: {
      title: 'SJB Association Membership Fee',
      description: 'One-time non-alumni membership fee',
      logo: 'https://www.flutterwave.com/images/logo/logo-mark.svg',
    },
    callback: async function () {
      // Do NOT trust this callback as proof of payment — just use it as a
      // trigger to ask our server to check with Flutterwave directly.
      const result = await verifyWithServer({ tx_ref, kind: 'membership' });
      if (result.success) {
        window.location.href = `${BASE_URL}/dashboard.html?fee_paid=1`;
      } else {
        alert(result.error || 'We could not confirm your payment yet. If money left your account, contact an admin with this reference: ' + tx_ref);
      }
    },
    onclose: function () {
      // Modal closed — payment may still be processing; verify anyway in
      // case it actually succeeded before the modal closed.
      verifyWithServer({ tx_ref, kind: 'membership' }).then((r) => {
        if (r.success) window.location.href = `${BASE_URL}/dashboard.html?fee_paid=1`;
      });
    },
  });
}

export async function paySavingsContribution({ group, monthYear, amount, currency = 'UGX' }) {
  const { data: { user } } = await supabase.auth.getUser();
  const tx_ref = genTxRef('SAVE');

  const { error: insertErr } = await supabase.from('savings_transactions').insert({
    group_id: group.id, user_id: user.id, type: 'contribution', amount,
    month_year: monthYear, payment_method: 'online', status: 'pending', tx_ref,
  });
  if (insertErr) { alert('Could not start contribution: ' + insertErr.message); return; }

  FlutterwaveCheckout({
    public_key: FLW_PUBLIC_KEY,
    tx_ref,
    amount,
    currency,
    payment_options: 'card, mobilemoneyuganda',
    customer: { email: user.email, name: user.user_metadata?.full_name || user.email },
    customizations: {
      title: `${group.name} — Monthly Savings`,
      description: `Contribution for ${monthYear}`,
      logo: 'https://www.flutterwave.com/images/logo/logo-mark.svg',
    },
    callback: async function () {
      const result = await verifyWithServer({ tx_ref, kind: 'savings', group_id: group.id, month_year: monthYear });
      if (result.success) {
        window.location.href = `${BASE_URL}/savings/dashboard.html?group=${group.id}&contributed=1`;
      } else {
        alert(result.error || 'We could not confirm your payment yet. Reference: ' + tx_ref);
      }
    },
    onclose: function () {
      verifyWithServer({ tx_ref, kind: 'savings', group_id: group.id, month_year: monthYear }).then((r) => {
        if (r.success) window.location.href = `${BASE_URL}/savings/dashboard.html?group=${group.id}&contributed=1`;
      });
    },
  });
}
