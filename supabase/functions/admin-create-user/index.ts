// supabase/functions/admin-create-user/index.ts
//
// Deploy with:
//   supabase functions deploy admin-create-user
//
// No extra secrets to set — SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are
// already injected automatically into every Edge Function's environment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client scoped to the CALLER's JWT — used only to figure out who is calling.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header." }, 401);

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return jsonResponse({ error: "Could not verify caller identity." }, 401);
    }

    // Confirm the caller is an admin in your own profiles table.
    const { data: callerProfile, error: profileLookupErr } = await callerClient
      .from("profiles")
      .select("role, is_super_admin")
      .eq("id", callerUser.id)
      .single();

    if (profileLookupErr || (callerProfile?.role !== "admin" && !callerProfile?.is_super_admin)) {
      return jsonResponse({ error: "Only admins can create users." }, 403);
    }

    const body = await req.json();
    const {
      email,
      password,
      fullName,
      phone,
      gradYear,
      profession,
      location,
      role,
      status,
      membershipClass,
      feePaid,
    } = body;

    // Making a new account an admin is a super-admin-only privilege —
    // a regular admin can still create members/leaders, just not admins.
    if (role === "admin" && !callerProfile?.is_super_admin) {
      return jsonResponse({ error: "Only the super admin can create admin accounts." }, 403);
    }

    if (!email || !password || !fullName) {
      return jsonResponse({ error: "email, password, and fullName are required." }, 400);
    }

    // From here on, use a full service-role client (bypasses RLS) to do the
    // privileged work: create the auth user, then insert the profile row.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Create the auth user directly (no signUp session-swap, no email needed).
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // mark verified immediately since an admin is vouching for them
      user_metadata: { full_name: fullName },
    });

    if (createErr) {
      return jsonResponse({ error: createErr.message ?? "Failed to create auth user." }, 400);
    }

    const newUserId = created.user?.id;
    if (!newUserId) {
      return jsonResponse({ error: "Auth user created but no ID was returned." }, 500);
    }

    // 2. Upsert the profile row with admin-set fields.
    const nowIso = new Date().toISOString();
    const profilePayload = {
      id: newUserId,
      email,
      full_name: fullName,
      phone: phone || null,
      graduation_year: gradYear || null,
      profession: profession || null,
      location: location || null,
      role: role || "member",
      status: status || "pending",
      membership_class: membershipClass || "non_alumni",
      membership_fee_paid: !!feePaid,
      membership_fee_paid_at: feePaid ? nowIso : null,
      approved_by: status === "approved" ? callerUser.id : null,
      approved_at: status === "approved" ? nowIso : null,
      onboarding_completed: true,
    };

    const { error: profileErr } = await adminClient.from("profiles").upsert(profilePayload);

    if (profileErr) {
      // Roll back the auth user so we don't end up with an orphaned account.
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: profileErr.message ?? "Failed to create profile row." }, 400);
    }

    return jsonResponse({ success: true, userId: newUserId });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
