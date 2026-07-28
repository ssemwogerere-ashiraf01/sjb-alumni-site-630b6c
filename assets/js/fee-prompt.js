import { BASE_URL } from './site-config.js';
import { supabase } from './supabase-client.js';

// Full-screen overlay: pay membership fee before savings (and similar) access.
// Shows the correct amount for alumni (3,000) vs non-alumni (15,000).
export async function showFeePaymentPrompt() {
  if (document.getElementById('fee-payment-overlay')) return;

  let amount = 15000;
  let tier = 'non-alumni';
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_class, membership_fee_paid')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.membership_fee_paid) return; // already paid — do not show overlay
      const isAlumni = profile?.membership_class === 'alumni';
      tier = isAlumni ? 'alumni' : 'non-alumni';
      const feeKey = isAlumni ? 'membership_fee_alumni' : 'membership_fee_non_alumni';
      const { data: settings } = await supabase.from('app_settings').select('value').eq('key', feeKey).maybeSingle();
      amount = Number(settings?.value?.amount ?? (isAlumni ? 3000 : 15000));
    }
  } catch (_) { /* keep defaults */ }

  const overlay = document.createElement('div');
  overlay.id = 'fee-payment-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(22,35,58,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;';
  overlay.innerHTML = `
    <div class="auth-card" style="max-width:460px;text-align:center;">
      <h2 style="margin-top:0;">Complete your membership fee</h2>
      <p class="subtitle" style="text-align:left;">
        Your account is <strong>approved</strong>. To use savings groups and full member benefits, pay the one-time
        <strong>${tier}</strong> membership fee of <strong>UGX ${amount.toLocaleString()}</strong>.
      </p>
      <p class="subtitle" style="text-align:left;font-size:0.88rem;">
        This is separate from any savings group join fee. Payment is confirmed automatically after Flutterwave checkout.
      </p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;">
        <a href="${BASE_URL}/membership-payment.html" class="btn btn-gold">Yes, Pay Now (UGX ${amount.toLocaleString()})</a>
        <a href="${BASE_URL}/dashboard.html" class="btn btn-outline-light" style="background:var(--ink-navy);color:#fff;">Not Right Now</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
