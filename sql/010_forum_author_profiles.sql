-- =========================================================================
-- FORUM AUTHOR DISPLAY HELPERS
-- Exposes only the name and photo needed to render forum topics/replies
-- without opening up the profiles table to all members.
-- =========================================================================

create or replace function public.forum_author_profile(p_user_id uuid)
returns table(full_name text, profile_photo_url text)
language sql
security definer
stable
as $$
  select p.full_name, p.profile_photo_url
  from public.profiles p
  where p.id = p_user_id;
$$;