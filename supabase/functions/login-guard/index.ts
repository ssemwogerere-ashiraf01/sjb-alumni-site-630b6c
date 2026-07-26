// =========================================================================
// login-guard Edge Function
// Deploy with: supabase functions deploy login-guard
// Enforces: 4 failed attempts -> 20 minute lockout, per email.
// The client calls THIS instead of supabase.auth.signInWithPassword()
// directly, so the rule can't be bypassed by calling the SDK straight.
//
// NOTE: this only verifies the password is correct and the account isn't
// locked/pending — it does NOT establish a session anymore. The client
// follows a successful response here by sending a one-time email code via
// supabase.auth.signInWithOtp(), and ONLY verifying that code actually logs
// the person in. This makes email OTP a mandatory second factor on every
// password login, not just an optional extra.
// =========================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // set as a secret, never in frontend code
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const MAX_ATTEMPTS = 4;
const LOCKOUT_MINUTES = 20;

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // tighten to your real domain in production
    'Access-Control-Allow-Headers': 'authorization, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return json({ error: 'Email and password are required.' }, 400, corsHeaders);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Check existing lockout on the profile
    const { data: profile } = await admin
      .from('profiles')
      .select('id, locked_until, failed_login_count, status')
      .eq('email', email)
      .maybeSingle();

    if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(profile.locked_until).getTime() - Date.now()) / 60000);
      return json({ error: `Account locked. Try again in ${minsLeft} minute(s).` }, 423, corsHeaders);
    }

    // 2. Attempt the actual password sign-in against GoTrue directly
    const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const tokenData = await tokenRes.json();
    const success = tokenRes.ok && tokenData.access_token;

    // 3. Log the attempt (service role bypasses RLS)
    await admin.from('login_attempts').insert({
      email,
      success,
      ip_address: req.headers.get('x-forwarded-for') ?? 'unknown',
    });

    if (!success) {
      if (profile) {
        const newCount = (profile.failed_login_count ?? 0) + 1;
        const update: Record<string, unknown> = { failed_login_count: newCount };
        if (newCount >= MAX_ATTEMPTS) {
          update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60000).toISOString();
        }
        await admin.from('profiles').update(update).eq('id', profile.id);
      }
      return json({ error: 'Incorrect email or password.' }, 401, corsHeaders);
    }

    // 4. Success — reset the counter and lockout
    if (profile) {
      await admin.from('profiles').update({ failed_login_count: 0, locked_until: null }).eq('id', profile.id);
    }

    if (profile?.status !== 'approved') {
      return json({ error: 'Your account is pending approval. You will be notified once an admin approves you.' }, 403, corsHeaders);
    }

    return json({ success: true }, 200, corsHeaders);
  } catch (e) {
    return json({ error: 'Unexpected error. Please try again.' }, 500, corsHeaders);
  }
});

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
