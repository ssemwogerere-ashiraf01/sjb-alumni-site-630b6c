import { BASE_URL } from './site-config.js';

// Renders a full-screen overlay asking the person if they're ready to pay
// their membership fee, instead of silently yanking them to the payment
// page. Works on any page since it appends itself to <body> rather than
// depending on that page's specific layout.
export function showFeePaymentPrompt() {
  if (document.getElementById('fee-payment-overlay')) return; // don't stack duplicates

  const overlay = document.createElement('div');
  overlay.id = 'fee-payment-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(22,35,58,0.55);display:flex;align-items:center;justify-content:center;z-index:9999;padding:1rem;';
  overlay.innerHTML = `
    <div class="auth-card" style="max-width:440px;text-align:center;">
      <h2 style="margin-top:0;">Complete your membership fee</h2>
      <p class="subtitle">Savings groups are only open to members who've paid their membership fee. Ready to take care of that now?</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem;">
        <a href="${BASE_URL}/membership-payment.html" class="btn btn-gold">Yes, Pay Now</a>
        <a href="${BASE_URL}/dashboard.html" class="btn btn-outline-light" style="background:var(--ink-navy);color:#fff;">Not Right Now</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
