import { supabase } from './supabase-client.js';
import { BASE_URL } from './site-config.js';

// Replace with your deployed function URL, e.g.
// https://azqixcnkhkzebufenbpx.supabase.co/functions/v1/login-guard
const LOGIN_GUARD_URL = 'https://azqixcnkhkzebufenbpx.supabase.co/functions/v1/login-guard';

export async function registerWithEmail({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };
  return { data, message: 'Account created. An admin will review and approve your account before you can sign in.' };
}

export async function loginWithEmail({ email, password }) {
  const res = await fetch(LOGIN_GUARD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const result = await res.json();
  if (!res.ok) return { error: result.error || 'Login failed.' };

  // Password is correct and the account isn't locked/pending — but no
  // session exists yet. Send a one-time code and require it before this
  // person is actually considered logged in.
  const { error: otpErr } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (otpErr) return { error: otpErr.message };

  return { requireOtp: true, email };
}

// Second step of login: the code from email is the only thing that
// actually establishes a session — a correct password alone never does.
export async function verifyLoginOtp({ email, token }) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) return { error: error.message };
  return await routeAfterLogin();
}

// Lets the person request a fresh code if the first one expired or didn't arrive.
export async function resendLoginOtp({ email }) {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) return { error: error.message };
  return { sent: true };
}

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/dashboard.html` },
  });
  if (error) alert(error.message);
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = `${BASE_URL}/login.html`;
}

// After any successful login, send the person to the right place based on
// their approval / membership-fee status rather than assuming dashboard.
export async function routeAfterLogin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Session not found.' };

  const { data: profile } = await supabase.from('profiles').select('status, membership_fee_paid, membership_class, onboarding_completed').eq('id', user.id).single();

  if (!profile) {
    window.location.href = `${BASE_URL}/pending-approval.html`;
  } else if (!profile.onboarding_completed) {
    window.location.href = `${BASE_URL}/onboarding.html`;
  } else if (profile.status === 'pending') {
    window.location.href = `${BASE_URL}/pending-approval.html`;
  } else if (profile.status === 'rejected' || profile.status === 'kicked' || profile.status === 'suspended') {
    await supabase.auth.signOut();
    window.location.href = `${BASE_URL}/login.html?denied=1`;
  } else if (!profile.membership_fee_paid) {
    window.location.href = `${BASE_URL}/membership-payment.html`;
  } else {
    window.location.href = `${BASE_URL}/dashboard.html`;
  }
  return {};
}

// Run this on login.html/register.html to route users already mid-session
// (e.g. returning from Google OAuth redirect) without showing the form again.
export async function redirectIfAlreadyLoggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await routeAfterLogin();
}
