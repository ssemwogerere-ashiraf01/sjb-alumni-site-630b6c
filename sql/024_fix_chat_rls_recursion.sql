-- Fix infinite recursion on chat_group_members / chat_groups RLS
-- Also restore reliable SELECT for family + DM history.

-- Helper: bypass RLS when checking membership (security definer)
create or replace function public.is_chat_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_chat_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.chat_group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  )
  or exists (
    select 1 from public.chat_groups
    where id = gid and created_by = auth.uid()
  );
$$;

grant execute on function public.is_chat_group_member(uuid) to authenticated;
grant execute on function public.is_chat_group_admin(uuid) to authenticated;

-- Replace recursive policies on chat_group_members
drop policy if exists "cgm_select" on public.chat_group_members;
drop policy if exists "cgm_insert" on public.chat_group_members;
drop policy if exists "cgm_delete" on public.chat_group_members;
drop policy if exists "cgm_update" on public.chat_group_members;

create policy "cgm_select" on public.chat_group_members
  for select using (
    user_id = auth.uid()
    or public.is_chat_group_member(group_id)
    or public.is_admin()
  );

create policy "cgm_insert" on public.chat_group_members
  for insert with check (
    public.is_approved_member()
    and (
      user_id = auth.uid()
      or public.is_chat_group_admin(group_id)
    )
  );

create policy "cgm_delete" on public.chat_group_members
  for delete using (
    user_id = auth.uid()
    or public.is_chat_group_admin(group_id)
    or public.is_admin()
  );

-- chat_groups policies without recursive member subquery issues
drop policy if exists "cg_select" on public.chat_groups;
drop policy if exists "cg_insert" on public.chat_groups;
drop policy if exists "cg_update" on public.chat_groups;

create policy "cg_select" on public.chat_groups
  for select using (
    public.is_admin()
    or created_by = auth.uid()
    or public.is_chat_group_member(id)
  );

create policy "cg_insert" on public.chat_groups
  for insert with check (
    created_by = auth.uid() and public.is_approved_member()
  );

create policy "cg_update" on public.chat_groups
  for update using (
    public.is_chat_group_admin(id) or public.is_admin()
  );

-- chat_messages: use helper instead of direct subquery on members
drop policy if exists "chat_family_select" on public.chat_messages;
drop policy if exists "chat_select" on public.chat_messages;
drop policy if exists "chat_insert_members" on public.chat_messages;

create policy "chat_select" on public.chat_messages
  for select using (
    public.is_admin()
    or (
      public.is_approved_member()
      and (
        room = 'family'
        or (room = 'dm' and (sender_id = auth.uid() or recipient_id = auth.uid()))
        or (room = 'group' and public.is_chat_group_member(group_id))
      )
    )
  );

create policy "chat_insert_members" on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_approved_member()
    and (
      (room = 'family' and recipient_id is null and group_id is null)
      or (room = 'dm' and recipient_id is not null and recipient_id <> auth.uid() and group_id is null)
      or (room = 'group' and group_id is not null and recipient_id is null and public.is_chat_group_member(group_id))
    )
  );

-- Soften room_shape if old rows have nulls that confuse inserts of media-only
-- (keep constraint; ensure group_id column exists)
alter table public.chat_messages add column if not exists group_id uuid;
alter table public.chat_messages add column if not exists reply_to_id uuid;
alter table public.chat_messages add column if not exists media_url text;
alter table public.chat_messages add column if not exists media_type text;
alter table public.chat_messages add column if not exists media_name text;

notify pgrst, 'reload schema';
