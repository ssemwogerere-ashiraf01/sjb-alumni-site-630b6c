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

/** Resend accepts batches; keep chunks small for reliability. */
const BATCH_SIZE = 40;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    // Support both Database Webhook shape { record, table, type }
    // and manual invoke { record, table }.
    const record = payload.record ?? payload.new ?? payload;
    const table = payload.table ?? payload.table_name ?? "";
    const eventType = (payload.type ?? payload.event ?? "INSERT").toString().toUpperCase();

    // Only announce creates (and optional publishes). Ignore pure updates unless is_active flipped on.
    if (eventType === "DELETE") {
      return json({ message: "Ignored delete event." });
    }

    if (!record || typeof record !== "object") {
      return json({ error: "No record found in payload." }, 400);
    }

    // Prefer active content only when the column exists.
    if (record.is_active === false) {
      return json({ message: "Skipped inactive/hidden record." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: subscribers, error: subErr } = await supabase
      .from("subscribers")
      .select("email")
      .eq("is_active", true);

    if (subErr) {
      return json({ error: `Could not load subscribers: ${subErr.message}` }, 500);
    }

    const emailList = [...new Set((subscribers?.map((s) => s.email) || []).filter(Boolean))];
    if (emailList.length === 0) {
      return json({ message: "No active subscribers to send to." });
    }

    const siteBase =
      Deno.env.get("PUBLIC_SITE_URL")?.replace(/\/$/, "") ||
      "https://sjb-alumni-site-630b6c-3hj7.vercel.app";

    let subject = "New Update — SJB Association";
    let title = record.title || "New posting";
    let excerpt =
      (record.content || record.description || record.manifesto || "Check out the latest details on our website.")
        .toString()
        .replace(/\s+/g, " ")
        .trim();
    if (excerpt.length > 220) excerpt = excerpt.slice(0, 217) + "…";

    let pageUrl = `${siteBase}/index.html`;
    if (table === "jobs") {
      subject = `Job alert: ${title}${record.company ? ` (${record.company})` : ""}`;
      pageUrl = `${siteBase}/jobs.html?id=${record.id}`;
    } else if (table === "events") {
      subject = `Event: ${title}`;
      pageUrl = `${siteBase}/events.html?id=${record.id}`;
    } else if (table === "forum_topics") {
      subject = `Forum: ${title}`;
      pageUrl = `${siteBase}/forum/index.html?topic=${record.id}`;
    } else if (table === "news") {
      subject = `News: ${title}`;
      pageUrl = `${siteBase}/news.html?id=${record.id}`;
    } else if (table === "savings_announcements") {
      subject = `Savings: ${title}`;
      pageUrl = `${siteBase}/savings/dashboard.html`;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return json({ error: "Missing RESEND_API_KEY secret on the Edge Function." }, 500);
    }

    // Must be a domain verified in Resend (not onboarding@resend.dev for production lists).
    const fromAddress =
      Deno.env.get("RESEND_FROM") ||
      "SJB Association <onboarding@resend.dev>";

    const html = `
      <div style="font-family: system-ui, sans-serif; padding: 24px; line-height: 1.55; color: #1b1b1b;">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#1f4b3f;font-weight:700;">SJB Association</p>
        <h2 style="margin:0 0 12px;color:#16233a;">${escapeHtml(title)}</h2>
        <p style="margin:0 0 20px;color:#55605c;">${escapeHtml(excerpt)}</p>
        <p><a href="${pageUrl}" style="background:#1f4b3f;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;font-weight:600;">Read more</a></p>
        <p style="margin-top:28px;font-size:12px;color:#88908a;">You receive this because you subscribed on the SJB Association website. Contact admin@sjbassociation.org to unsubscribe.</p>
      </div>
    `;

    const results: { batch: number; ok: boolean; status?: number; detail?: string }[] = [];
    for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
      const batch = emailList.slice(i, i + BATCH_SIZE);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: batch,
          subject,
          html,
        }),
      });
      const body = await res.json().catch(() => ({}));
      results.push({
        batch: Math.floor(i / BATCH_SIZE) + 1,
        ok: res.ok,
        status: res.status,
        detail: res.ok ? undefined : (body?.message || JSON.stringify(body)).slice(0, 200),
      });
    }

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      return json({
        error: "Some Resend batches failed. Verify RESEND_API_KEY, RESEND_FROM domain, and that recipients are allowed.",
        results,
        subscriber_count: emailList.length,
      }, 502);
    }

    return json({ success: true, subscriber_count: emailList.length, batches: results.length });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
