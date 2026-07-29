# Newsletter delivery setup

Subscribing on the home page only **stores** the email in `public.subscribers`.
Emails about new posts are sent by the **`send-newsletter`** Edge Function when
it is triggered after content is created.

## 1. Deploy the function

```bash
supabase functions deploy send-newsletter
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
# Production: use a domain verified in Resend
supabase secrets set RESEND_FROM="SJB Association <news@yourdomain.org>"
supabase secrets set PUBLIC_SITE_URL="https://your-production-domain.org"
```

**Important:** Resend’s default `onboarding@resend.dev` sender can only deliver
to the email address of the Resend account owner. For a real subscriber list you
**must** verify your own domain in Resend and set `RESEND_FROM`.

## 2. Database Webhooks (Supabase Dashboard)

Database → Webhooks → Create a new webhook for each table you want to announce:

| Table | Events | URL |
|-------|--------|-----|
| `news` | INSERT | `https://<project>.supabase.co/functions/v1/send-newsletter` |
| `events` | INSERT | same |
| `jobs` | INSERT | same |
| `forum_topics` | INSERT | same |
| `savings_announcements` | INSERT | same |

HTTP method: POST. Add header `Authorization: Bearer <service_role_or_anon as configured>`.
Payload should include `record` and `table` (Supabase Database Webhooks do this by default).

Without these webhooks, subscribers are saved but **never emailed**.

## 3. Test

1. Subscribe with your own email on the home page.
2. As admin, create a News item (or call the function manually with a sample JSON body).
3. Check Resend dashboard → Logs for delivery or domain errors.
