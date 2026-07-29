-- Online presence: last_seen_at + heartbeat RPC + admin visibility
-- Run after prior migrations.

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_seen_path text;

comment on column public.profiles.last_seen_at is 'Updated by client heartbeat; online if within ~2 minutes';
comment on column public.profiles.last_seen_path is 'Last path the member had open (optional)';

-- Members update only their own presence via this function (bypasses sensitive-field trigger concerns)
create or replace function public.heartbeat(p_path text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  update public.profiles
  set
    last_seen_at = now(),
    last_seen_path = left(coalesce(p_path, last_seen_path, ''), 200)
  where id = auth.uid();
end;
$$;

grant execute on function public.heartbeat(text) to authenticated;

-- Admin listing of "online" members (last_seen within 2 minutes)
create or replace function public.admin_online_members()
returns table (
  id uuid,
  full_name text,
  email text,
  profile_photo_url text,
  last_seen_at timestamptz,
  last_seen_path text,
  role text,
  status text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    p.id,
    p.full_name,
    p.email,
    p.profile_photo_url,
    p.last_seen_at,
    p.last_seen_path,
    p.role,
    p.status
  from public.profiles p
  where public.is_admin()
    and p.last_seen_at is not null
    and p.last_seen_at > now() - interval '2 minutes'
  order by p.last_seen_at desc;
$$;

grant execute on function public.admin_online_members() to authenticated;

-- Count online for dashboard stats
create or replace function public.admin_online_count()
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
  from public.profiles p
  where public.is_admin()
    and p.last_seen_at is not null
    and p.last_seen_at > now() - interval '2 minutes';
$$;

grant execute on function public.admin_online_count() to authenticated;

notify pgrst, 'reload schema';
