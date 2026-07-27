// supabase/functions/admin-delete-user/index.ts
//
// Permanently deletes a member's auth user (their profiles row cascades
// with it via `profiles.id references auth.users(id) on delete cascade`).
//
// Only the designated super admin (profiles.is_super_admin = true) may
// call this — regular admins are rejected even though they can call the
// function endpoint, because authorization is re-checked here against the
// database, not just against a role claimed by the client.
//
// Deploy with:
//   supabase functions deploy admin-delete-user

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

    // Confirm the caller is THE super admin — not just any admin.
    const { data: callerProfile, error: profileLookupErr } = await callerClient
      .from("profiles")
      .select("is_super_admin")
      .eq("id", callerUser.id)
      .single();

    if (profileLookupErr || !callerProfile?.is_super_admin) {
      return jsonResponse({ error: "Only the super admin can permanently delete an account." }, 403);
    }

    const body = await req.json();
    const { userId } = body;
    if (!userId) {
      return jsonResponse({ error: "userId is required." }, 400);
    }

    if (userId === callerUser.id) {
      return jsonResponse({ error: "You cannot delete your own account." }, 400);
    }

    // Full service-role client for the privileged work below.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Never allow deleting a super admin account (there should only ever
    // be one, but this guards against ever being pointed at the wrong id).
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("is_super_admin, email")
      .eq("id", userId)
      .single();

    if (targetProfile?.is_super_admin) {
      return jsonResponse({ error: "The super admin account cannot be deleted." }, 400);
    }

    const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return jsonResponse({ error: deleteErr.message ?? "Failed to delete user." }, 400);
    }

    // Belt-and-suspenders: the FK cascade should already remove the profile
    // row, but clean up explicitly in case the row was ever created without
    // the FK (e.g. restored from a backup).
    await adminClient.from("profiles").delete().eq("id", userId);

    return jsonResponse({ success: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected server error." }, 500);
  }
});
