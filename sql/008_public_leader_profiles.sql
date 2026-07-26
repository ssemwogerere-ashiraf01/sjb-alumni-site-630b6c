-- =========================================================================
-- FIX: leadership.html (and the landing page's Leadership section) would
-- show blank names/photos, because profiles RLS only allows reading your
-- own row (or an admin reading anyone's) — it never allowed the public to
-- read OTHER members' names, even elected leaders.
--
-- Fix: a narrow, security-definer function that exposes ONLY full_name and
-- profile_photo_url, and ONLY for people who are (or were) listed in
-- public.leaders. This does not open up phone numbers, emails, or any
-- other profile field — just the two fields needed to render a leader card.
--
-- Run after 001-007.
-- =========================================================================
create or replace function public.public_leader_profile(p_user_id uuid)
returns table(full_name text, profile_photo_url text)
language sql
security definer
stable
as $$
  select p.full_name, p.profile_photo_url
  from public.profiles p
  where p.id = p_user_id
    and exists (select 1 from public.leaders l where l.user_id = p_user_id);
$$;
