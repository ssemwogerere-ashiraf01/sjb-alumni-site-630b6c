import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';
import { showFeePaymentPrompt } from './fee-prompt.js';

const IDLE_LIMIT_MS = 10 * 60 * 1000;   // 10 minutes idle -> logout
const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes -> refresh session/data

let idleTimer;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    await supabase.auth.signOut();
    alert('You have been signed out due to inactivity. Please log in again.');
    window.location.href = `${BASE_URL}/login.html?timeout=1`;
  }, IDLE_LIMIT_MS);
}

['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((evt) =>
  window.addEventListener(evt, resetIdleTimer, { passive: true })
);
resetIdleTimer();

// Periodic refresh: renews the auth token and lets pages re-pull fresh data
// (e.g. updated savings balance, election status) without a manual reload.
setInterval(async () => {
  const { error } = await supabase.auth.refreshSession();
  if (error) {
    window.location.href = `${BASE_URL}/login.html?expired=1`;
    return;
  }
  window.dispatchEvent(new CustomEvent('app:refresh'));
}, REFRESH_INTERVAL_MS);

// Guard export: call at the top of any protected page. Redirects to login
// if there's no session, and to pending-approval / membership-payment if
// the account isn't fully cleared yet (mirrors auth.js routeAfterLogin).
export async function requireApprovedMember() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${BASE_URL}/login.html`;
    return null;
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    window.location.href = `${BASE_URL}/pending-approval.html`;
    return null;
  }
  if (!profile.onboarding_completed) {
    window.location.href = `${BASE_URL}/onboarding.html`;
    return null;
  }
  if (profile.status !== 'approved') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
    return null;
  }
  if (!profile.membership_fee_paid) {
    showFeePaymentPrompt();
    return null;
  }
  return profile;
}

// Lighter guard: just check the user is logged in, without requiring
// approved/fee-paid status. Suitable for news, events, jobs pages
// where pending members should still be able to view content.
export async function requireLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = `${BASE_URL}/login.html`;
    return null;
  }
  return session;
}
