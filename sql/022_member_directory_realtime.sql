-- Member directory for chat (name + photo only) + enable Realtime for chat_messages
-- Run after 021.

create or replace function public.member_directory()
returns table (
  id uuid,
  full_name text,
  profession text,
  location text,
  profile_photo_url text
)
language sql
security definer
stable
set search_path = public
as $$
  select p.id, p.full_name, p.profession, p.location, p.profile_photo_url
  from public.profiles p
  where p.status = 'approved'
    and (public.is_approved_member() or public.is_admin());
$$;

revoke all on function public.member_directory() from public;
grant execute on function public.member_directory() to authenticated;

-- Add chat_messages to the realtime publication (ignore if already added)
do $$
begin
  alter publication supabase_realtime add table public.chat_messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'Publication supabase_realtime not found — enable Realtime for chat_messages in the Dashboard.';
end $$;
