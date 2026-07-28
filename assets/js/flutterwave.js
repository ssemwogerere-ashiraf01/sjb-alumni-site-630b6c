import { supabase, SUPABASE_URL } from './supabase-client.js';
import { BASE_URL } from './site-config.js';

const VERIFY_URL = `${SUPABASE_URL}/functions/v1/verify-flutterwave`;

// TEST public key — pair with FLWSECK_TEST-… on the Edge Function.
const FLW_PUBLIC_KEY = 'FLWPUBK_TEST-361c473981b702b6fd43bf310c9be55c-X';

const PENDING_KEY = 'flw_pending_payment';

function genTxRef(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

function ensureFlutterwaveLoaded() {
  if (typeof window.FlutterwaveCheckout !== 'function') {
    throw new Error(
      'Flutterwave checkout script is not loaded. Check your network and that checkout.flutterwave.com is allowed.'
    );
  }
}

function savePending(payload) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ ...payload, savedAt: Date.now() }));
  } catch (_) { /* private mode */ }
}

export function loadPending() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPending() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch (_) {}
}

export async function verifyWithServer({ tx_ref, kind, group_id, month_year }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'Your session expired. Please sign in again and try verifying the payment.' };
  }

  let res;
  try {
    res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tx_ref, kind, group_id, month_year }),
    });
  } catch (err) {
    return { error: `Could not reach payment verification server: ${err.message || err}` };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { error: `Verification server returned HTTP ${res.status} with no JSON body.` };
  }

  if (!res.ok && !body?.error) {
    body.error = `Verification failed (HTTP ${res.status}).`;
  }
  return body;
}

async function getUgxToUsdRate() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/UGX');
    const data = await res.json();
    return data?.rates?.USD ?? 0.00027;
  } catch {
    return 0.00027;
  }
}

function openCheckout({
  tx_ref,
  amount,
  currency,
  customer,
  title,
  description,
  onVerified,
  verifyArgs,
  successPath,
}) {
  ensureFlutterwaveLoaded();

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(`Invalid payment amount: ${amount}`);
  }

  // Persist so the return page can verify after 3DS / OTP redirect
  // (inline callback often does NOT run when Flutterwave navigates away).
  savePending({
    ...verifyArgs,
    tx_ref,
    successPath: successPath || `${BASE_URL}/savings/register.html?paid=1`,
  });

  let verifying = false;
  const runVerify = async (source) => {
    if (verifying) return;
    verifying = true;
    try {
      const result = await verifyWithServer(verifyArgs);
      if (result.success) {
        clearPending();
        onVerified(result);
      } else {
        console.warn(`[flutterwave] verify failed (${source}):`, result);
        // Don't alert on onclose if payment may still be processing via redirect.
        if (source !== 'onclose') {
          alert(
            result.error ||
              `We could not confirm your payment yet (${source}). Reference: ${tx_ref}`
          );
        }
      }
    } finally {
      verifying = false;
    }
  };

  // Always return to a page that finishes verification from sessionStorage.
  const returnUrl = `${BASE_URL}/savings/payment-return.html`;

  window.FlutterwaveCheckout({
    public_key: FLW_PUBLIC_KEY,
    tx_ref,
    amount: numericAmount,
    currency: currency || 'UGX',
    payment_options: 'card,mobilemoneyuganda,ussd',
    redirect_url: returnUrl,
    customer: {
      email: customer.email,
      name: customer.name || customer.email,
      phone_number: customer.phone || undefined,
    },
    customizations: {
      title: title || 'SJB Association',
      description: description || 'Payment',
      // Omit broken logo URLs — empty is fine; avoids mixed-content / 404 noise.
      logo: '',
    },
    callback: async function (response) {
      console.info('[flutterwave] callback', response);
      if (response && response.status && response.status !== 'successful' && response.status !== 'completed') {
        alert(`Payment was not successful (status: ${response.status}). Reference: ${tx_ref}`);
        return;
      }
      await runVerify('callback');
    },
    onclose: function () {
      // If user paid via redirect/OTP, verification happens on payment-return.html.
      // Still try once in case the charge completed inside the modal.
      runVerify('onclose');
    },
  });
}

export async function paySavingsJoinFee(group) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = `${BASE_URL}/login.html`;
    return;
  }

  const fee = Number(group.group_join_fee);
  if (!Number.isFinite(fee) || fee <= 0) {
    alert('This group has no join fee configured. Ask an admin to set the join fee amount.');
    return;
  }

  const tx_ref = genTxRef('JOINFEE');

  const { data: existing } = await supabase
    .from('savings_group_members')
    .select('id, status, join_fee_paid')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing?.status === 'active') {
    alert('You are already an active member of this group.');
    window.location.href = `${BASE_URL}/savings/dashboard.html`;
    return;
  }
  if (existing?.join_fee_paid && existing?.status === 'pending') {
    alert('Join fee already paid. Waiting for an admin to activate your membership.');
    return;
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from('savings_group_members').insert({
      group_id: group.id,
      user_id: user.id,
      status: 'pending',
      join_fee_paid: false,
    });
    if (insertErr) {
      alert('Could not start registration: ' + insertErr.message);
      return;
    }
  }

  try {
    openCheckout({
      tx_ref,
      amount: fee,
      currency: group.currency || 'UGX',
      customer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      },
      title: `${group.name} — Join Fee`,
      description: 'One-time savings group registration fee',
      verifyArgs: { tx_ref, kind: 'savings_join_fee', group_id: group.id },
      successPath: `${BASE_URL}/savings/register.html?paid=1`,
      onVerified: () => {
        window.location.href = `${BASE_URL}/savings/register.html?paid=1`;
      },
    });
  } catch (err) {
    alert(err.message || String(err));
  }
}

export async function payMembershipFee({ currency = 'UGX' } = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = `${BASE_URL}/login.html`;
    return;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('membership_class, phone')
    .eq('id', user.id)
    .single();
  const feeKey = profile?.membership_class === 'alumni' ? 'membership_fee_alumni' : 'membership_fee_non_alumni';
  const { data: settings } = await supabase.from('app_settings').select('value').eq('key', feeKey).maybeSingle();
  const feeUgx = Number(settings?.value?.amount ?? (profile?.membership_class === 'alumni' ? 3000 : 15000));

  let amount = feeUgx;
  let payCurrency = currency || 'UGX';
  if (payCurrency === 'USD') {
    const rate = await getUgxToUsdRate();
    amount = Math.ceil(feeUgx * rate * 100) / 100;
  }

  const tx_ref = genTxRef('MEMFEE');

  const { error: insertErr } = await supabase.from('payments').insert({
    user_id: user.id,
    purpose: 'membership_fee',
    amount,
    currency: payCurrency,
    tx_ref,
    status: 'pending',
  });
  if (insertErr) {
    alert('Could not start payment: ' + insertErr.message);
    return;
  }

  try {
    openCheckout({
      tx_ref,
      amount,
      currency: payCurrency,
      customer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
        phone: profile?.phone || undefined,
      },
      title: 'SJB Association Membership Fee',
      description: 'One-time membership fee',
      verifyArgs: { tx_ref, kind: 'membership' },
      successPath: `${BASE_URL}/dashboard.html?fee_paid=1`,
      onVerified: () => {
        window.location.href = `${BASE_URL}/dashboard.html?fee_paid=1`;
      },
    });
  } catch (err) {
    alert(err.message || String(err));
  }
}

export async function paySavingsContribution({ group, monthYear, amount, currency = 'UGX' }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = `${BASE_URL}/login.html`;
    return;
  }

  const payAmount = Number(amount ?? group.monthly_contribution);
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    alert('Invalid monthly contribution amount. Ask an admin to check the group settings.');
    return;
  }

  const { data: existing } = await supabase
    .from('savings_transactions')
    .select('id, status, tx_ref')
    .eq('group_id', group.id)
    .eq('user_id', user.id)
    .eq('type', 'contribution')
    .eq('month_year', monthYear)
    .maybeSingle();

  if (existing?.status === 'completed') {
    alert('You have already contributed for this month.');
    return;
  }

  const tx_ref = genTxRef('SAVE');

  if (existing?.status === 'pending') {
    const { error: updErr } = await supabase
      .from('savings_transactions')
      .update({ tx_ref, amount: payAmount, payment_method: 'online' })
      .eq('id', existing.id);
    if (updErr) {
      alert('Could not restart contribution: ' + updErr.message);
      return;
    }
  } else {
    const { error: insertErr } = await supabase.from('savings_transactions').insert({
      group_id: group.id,
      user_id: user.id,
      type: 'contribution',
      amount: payAmount,
      month_year: monthYear,
      payment_method: 'online',
      status: 'pending',
      tx_ref,
    });
    if (insertErr) {
      alert('Could not start contribution: ' + insertErr.message);
      return;
    }
  }

  try {
    openCheckout({
      tx_ref,
      amount: payAmount,
      currency: currency || group.currency || 'UGX',
      customer: {
        email: user.email,
        name: user.user_metadata?.full_name || user.email,
      },
      title: `${group.name} — Monthly Savings`,
      description: `Contribution for ${monthYear}`,
      verifyArgs: {
        tx_ref,
        kind: 'savings',
        group_id: group.id,
        month_year: monthYear,
      },
      successPath: `${BASE_URL}/savings/dashboard.html?group=${group.id}&contributed=1`,
      onVerified: () => {
        window.location.href = `${BASE_URL}/savings/dashboard.html?group=${group.id}&contributed=1`;
      },
    });
  } catch (err) {
    alert(err.message || String(err));
  }
}
