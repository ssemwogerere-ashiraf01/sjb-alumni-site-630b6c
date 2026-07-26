import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';
import { showFeePaymentPrompt } from './fee-prompt.js';

// Everything under /savings/ except register.html requires the visitor to
// be an ACTIVE member of a specific group. RLS enforces this at the data
// layer regardless, but checking here gives a friendly redirect instead of
// a page full of empty/error states.
export async function requireActiveSavingsGroup() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { window.location.href = `${BASE_URL}/login.html`; return null; }

  const { data: profile } = await supabase.from('profiles').select('status, membership_fee_paid').eq('id', session.user.id).single();
  if (!profile || profile.status !== 'approved') { window.location.href = `${BASE_URL}/pending-approval.html`; return null; }
  if (!profile.membership_fee_paid) { showFeePaymentPrompt(); return null; }

  const { data: memberships } = await supabase
    .from('savings_group_members')
    .select('group_id, status, savings_groups(id, name, monthly_contribution, currency, group_join_fee)')
    .eq('user_id', session.user.id)
    .eq('status', 'active');

  if (!memberships || memberships.length === 0) {
    window.location.href = `${BASE_URL}/savings/register.html`;
    return null;
  }
  return { session, memberships };
}
