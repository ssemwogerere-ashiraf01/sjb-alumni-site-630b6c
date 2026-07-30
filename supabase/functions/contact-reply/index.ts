import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("RESEND_FROM") || "SJB Association <onboarding@resend.dev>";
    const site = Deno.env.get("PUBLIC_SITE_URL") || "https://sjb-alumni-site-630b6c.vercel.app";

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin.from("profiles").select("role, is_super_admin").eq("id", user.id).maybeSingle();
    const isAdmin = profile?.role === "admin" || profile?.role === "super_admin" || profile?.is_super_admin === true;
    if (!isAdmin) {
      // also allow is_admin() style via role member check - use RPC
      const { data: ok } = await admin.rpc("is_admin");
      // is_admin uses auth.uid - call as user
    }
    const { data: adminCheck } = await userClient.rpc("is_admin");
    if (!adminCheck && !isAdmin) return json({ error: "Admin only" }, 403);

    const body = await req.json();
    const messageId = body.message_id;
    const replyText = String(body.reply || "").trim();
    if (!messageId || !replyText) return json({ error: "message_id and reply required" }, 400);

    const { data: msg, error: msgErr } = await admin
      .from("contact_messages")
      .select("*")
      .eq("id", messageId)
      .single();
    if (msgErr || !msg) return json({ error: "Message not found" }, 404);

    const { error: upErr } = await admin.from("contact_messages").update({
      admin_reply: replyText,
      replied_at: new Date().toISOString(),
      replied_by: user.id,
      status: "replied",
    }).eq("id", messageId);
    if (upErr) return json({ error: upErr.message }, 500);

    let emailSent = false;
    let emailError: string | null = null;
    if (resendKey) {
      const html = `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#1b4332;">Reply from SJB Association</h2>
          <p>Hello ${msg.name || "there"},</p>
          <p>An administrator replied to your contact message:</p>
          <blockquote style="border-left:4px solid #d4af37;padding:0.75rem 1rem;background:#f8fafc;margin:1rem 0;">
            ${replyText.replace(/</g, "&lt;").replace(/\n/g, "<br/>")}
          </blockquote>
          <p style="color:#64748b;font-size:14px;"><strong>Your original message</strong> (${msg.topic || "general"}):</p>
          <p style="color:#64748b;font-size:14px;">${String(msg.message || "").replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>
          <p style="margin-top:1.5rem;"><a href="${site}/contact.html">Open contact page</a></p>
          <p style="color:#94a3b8;font-size:12px;">SJB Association</p>
        </div>
      `;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [msg.email],
          subject: `Re: SJB Association — ${msg.topic || "your message"}`,
          html,
        }),
      });
      if (res.ok) emailSent = true;
      else {
        const errText = await res.text();
        emailError = errText.slice(0, 200);
        console.error("Resend error", errText);
      }
    } else {
      emailError = "RESEND_API_KEY not set";
    }

    return json({
      ok: true,
      email_sent: emailSent,
      email_error: emailError,
      message: emailSent
        ? "Reply saved and emailed to the sender."
        : "Reply saved on the site. Email could not be sent: " + (emailError || "unknown"),
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
