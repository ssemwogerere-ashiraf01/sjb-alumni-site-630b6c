import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { record, table } = payload;

    if (!record) {
      return new Response(JSON.stringify({ error: "No record found" }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get active subscribers
    const { data: subscribers } = await supabase.from("subscribers").select("email");
    const emailList = [...new Set((subscribers?.map((s) => s.email) || []).filter(Boolean))];

    if (emailList.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers to send to." }), { status: 200 });
    }

    let subject = "New Update - St. Josephine Bakhita Alumni";
    let title = record.title || "New Posting";
    let excerpt = record.content || record.description || "Check out the latest details on our website.";
    let pageUrl = "https://sjb-alumni-site-630b6c-3hj7.vercel.app/index.html";

    if (table === "jobs") {
      subject = `💼 Job Alert: ${title} (${record.company || 'Company Confidential'})`;
      pageUrl = `https://sjb-alumni-site-630b6c-3hj7.vercel.app/jobs.html?id=${record.id}`;
    } else if (table === "events") {
      subject = `📅 Event Announcement: ${title}`;
      pageUrl = `https://sjb-alumni-site-630b6c-3hj7.vercel.app/events.html?id=${record.id}`;
    } else if (table === "forum_topics") {
      subject = `💬 New Discussion Topic: ${title}`;
      pageUrl = `https://sjb-alumni-site-630b6c-3hj7.vercel.app/forum/index.html?topic=${record.id}`;
    } else if (table === "news") {
      subject = `📰 News Release: ${title}`;
      pageUrl = `https://sjb-alumni-site-630b6c-3hj7.vercel.app/news.html?id=${record.id}`;
    } else if (table === "savings_announcements") {
      subject = `📣 Savings Announcement: ${title}`;
      pageUrl = `https://sjb-alumni-site-630b6c-3hj7.vercel.app/savings/dashboard.html`;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "Missing RESEND_API_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "St. Josephine Bakhita Alumni <onboarding@resend.dev>",
        to: emailList,
        subject: subject,
        html: `
          <div style="font-family: sans-serif; padding: 20px; line-height: 1.5;">
            <h2>${title}</h2>
            <p>${excerpt.substring(0, 200)}...</p>
            <p><a href="${pageUrl}" style="background:#1a56db; color:#fff; padding:10px 16px; text-decoration:none; border-radius:4px;">Read More</a></p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});