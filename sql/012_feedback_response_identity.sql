-- -------------------------------------------------------------------------
-- 012. Feedback response identity tracking
--
-- feedback_responses already ties each row to auth via user_id, but admins
-- reviewing results had no quick, human-readable attribution. Members are
-- now prompted to confirm an email + username right before they fill out
-- any feedback form, and that confirmed identity is stored alongside the
-- response so it shows up next to every answer/comment in the admin view.
--
-- Note: feedback_forms / feedback_questions / feedback_responses /
-- feedback_answers were created directly in the Supabase dashboard and
-- were never checked into sql/ — this migration only ALTERs the existing
-- feedback_responses table.
-- -------------------------------------------------------------------------

alter table public.feedback_responses
  add column if not exists submitted_email    text,
  add column if not exists submitted_username text;

comment on column public.feedback_responses.submitted_email is
  'Email the member typed/confirmed on the identity step right before filling out the form (may differ from profiles.email if they edited it).';
comment on column public.feedback_responses.submitted_username is
  'Username/display name the member typed/confirmed on the identity step, shown to admins next to their answers.';
