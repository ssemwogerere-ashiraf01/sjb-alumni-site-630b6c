-- WhatsApp-style chat: groups, unread, replies, reactions, media
-- Run AFTER 021 and 022. Safe to re-run.

-- 1. Extend chat_messages
alter table public.chat_messages
  add column if not exists group_id uuid,
  add column if not exists reply_to_id uuid,
  add column if not exists media_url text,
  add column if not exists media_type text,
  add column if not exists media_name text;

do $$ begin
  alter table public.chat_messages drop constraint if exists chat_messages_media_type_check;
  alter table public.chat_messages
    add constraint chat_messages_media_type_check
    check (media_type is null or media_type in ('image','audio','video','file','voice'));
exception when others then null;
end $$;

alter table public.chat_messages drop constraint if exists chat_messages_room_check;
alter table public.chat_messages
  add constraint chat_messages_room_check
  check (room in ('family', 'dm', 'group'));

alter table public.chat_messages drop constraint if exists chat_messages_check;
alter table public.chat_messages drop constraint if exists chat_messages_room_shape;
alter table public.chat_messages
  add constraint chat_messages_room_shape check (
    (room = 'family' and recipient_id is null and group_id is null)
    or (room = 'dm' and recipient_id is not null and group_id is null)
    or (room = 'group' and group_id is not null and recipient_id is null)
  );

do $$ begin
  alter table public.chat_messages drop constraint if exists chat_messages_reply_to_id_fkey;
  alter table public.chat_messages
    add constraint chat_messages_reply_to_id_fkey
    foreign key (reply_to_id) references public.chat_messages(id) on delete set null;
exception when others then null;
end $$;

-- 2. Groups
create table if not exists public.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  photo_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

create table if not exists public.chat_group_members (
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

do $$ begin
  alter table public.chat_messages drop constraint if exists chat_messages_group_id_fkey;
  alter table public.chat_messages
    add constraint chat_messages_group_id_fkey
    foreign key (group_id) references public.chat_groups(id) on delete cascade;
exception when others then null;
end $$;

-- 3. Read cursors (NO coalesce in PRIMARY KEY)
drop table if exists public.chat_reads cascade;

create table public.chat_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room text not null check (room in ('family','dm','group')),
  peer_id uuid references public.profiles(id) on delete cascade,
  group_id uuid references public.chat_groups(id) on delete cascade,
  last_read_at timestamptz not null default now()
);

create unique index if not exists chat_reads_family_uidx
  on public.chat_reads (user_id) where room = 'family';
create unique index if not exists chat_reads_dm_uidx
  on public.chat_reads (user_id, peer_id) where room = 'dm';
create unique index if not exists chat_reads_group_uidx
  on public.chat_reads (user_id, group_id) where room = 'group';

-- 4. Reactions
create table if not exists public.chat_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

-- 5. Calls
create table if not exists public.chat_calls (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room in ('dm','group')),
  peer_id uuid references public.profiles(id) on delete set null,
  group_id uuid references public.chat_groups(id) on delete set null,
  caller_id uuid not null references public.profiles(id) on delete cascade,
  call_type text not null check (call_type in ('audio','video')),
  status text not null default 'ringing'
    check (status in ('ringing','active','ended','missed','declined')),
  signal jsonb,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

-- 6. RLS
alter table public.chat_groups enable row level security;
alter table public.chat_group_members enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.chat_calls enable row level security;

drop policy if exists "cg_select" on public.chat_groups;
create policy "cg_select" on public.chat_groups for select using (
  public.is_admin()
  or created_by = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = id and m.user_id = auth.uid())
);
drop policy if exists "cg_insert" on public.chat_groups;
create policy "cg_insert" on public.chat_groups for insert with check (
  created_by = auth.uid() and public.is_approved_member()
);
drop policy if exists "cg_update" on public.chat_groups;
create policy "cg_update" on public.chat_groups for update using (
  created_by = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = id and m.user_id = auth.uid() and m.role = 'admin')
);

drop policy if exists "cgm_select" on public.chat_group_members;
create policy "cgm_select" on public.chat_group_members for select using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid())
);
drop policy if exists "cgm_insert" on public.chat_group_members;
create policy "cgm_insert" on public.chat_group_members for insert with check (
  public.is_approved_member()
  and (
    user_id = auth.uid()
    or exists (select 1 from public.chat_groups g where g.id = group_id and g.created_by = auth.uid())
    or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid() and m.role = 'admin')
  )
);
drop policy if exists "cgm_delete" on public.chat_group_members;
create policy "cgm_delete" on public.chat_group_members for delete using (
  user_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_group_members.group_id and m.user_id = auth.uid() and m.role = 'admin')
);

drop policy if exists "reads_own" on public.chat_reads;
create policy "reads_own" on public.chat_reads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "react_select" on public.chat_reactions;
create policy "react_select" on public.chat_reactions for select using (public.is_approved_member());
drop policy if exists "react_insert" on public.chat_reactions;
create policy "react_insert" on public.chat_reactions for insert with check (user_id = auth.uid() and public.is_approved_member());
drop policy if exists "react_delete" on public.chat_reactions;
create policy "react_delete" on public.chat_reactions for delete using (user_id = auth.uid());

drop policy if exists "calls_select" on public.chat_calls;
create policy "calls_select" on public.chat_calls for select using (
  public.is_admin() or caller_id = auth.uid() or peer_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_calls.group_id and m.user_id = auth.uid())
);
drop policy if exists "calls_insert" on public.chat_calls;
create policy "calls_insert" on public.chat_calls for insert with check (caller_id = auth.uid() and public.is_approved_member());
drop policy if exists "calls_update" on public.chat_calls;
create policy "calls_update" on public.chat_calls for update using (
  caller_id = auth.uid() or peer_id = auth.uid()
  or exists (select 1 from public.chat_group_members m where m.group_id = chat_calls.group_id and m.user_id = auth.uid())
);

drop policy if exists "chat_family_select" on public.chat_messages;
drop policy if exists "chat_select" on public.chat_messages;
create policy "chat_select" on public.chat_messages for select using (
  public.is_admin()
  or (
    public.is_approved_member()
    and (
      room = 'family'
      or (room = 'dm' and (sender_id = auth.uid() or recipient_id = auth.uid()))
      or (room = 'group' and exists (
        select 1 from public.chat_group_members m
        where m.group_id = chat_messages.group_id and m.user_id = auth.uid()
      ))
    )
  )
);

drop policy if exists "chat_insert_members" on public.chat_messages;
create policy "chat_insert_members" on public.chat_messages for insert with check (
  sender_id = auth.uid()
  and public.is_approved_member()
  and (
    (room = 'family' and recipient_id is null and group_id is null)
    or (room = 'dm' and recipient_id is not null and recipient_id <> auth.uid() and group_id is null)
    or (room = 'group' and group_id is not null and recipient_id is null and exists (
      select 1 from public.chat_group_members m
      where m.group_id = chat_messages.group_id and m.user_id = auth.uid()
    ))
  )
);

-- 7. Functions
create or replace function public.mark_chat_read(
  p_room text,
  p_peer_id uuid default null,
  p_group_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_room = 'family' then
    update public.chat_reads set last_read_at = now()
    where user_id = auth.uid() and room = 'family';
    if not found then
      insert into public.chat_reads (user_id, room, last_read_at)
      values (auth.uid(), 'family', now());
    end if;
  elsif p_room = 'dm' and p_peer_id is not null then
    update public.chat_reads set last_read_at = now()
    where user_id = auth.uid() and room = 'dm' and peer_id = p_peer_id;
    if not found then
      insert into public.chat_reads (user_id, room, peer_id, last_read_at)
      values (auth.uid(), 'dm', p_peer_id, now());
    end if;
  elsif p_room = 'group' and p_group_id is not null then
    update public.chat_reads set last_read_at = now()
    where user_id = auth.uid() and room = 'group' and group_id = p_group_id;
    if not found then
      insert into public.chat_reads (user_id, room, group_id, last_read_at)
      values (auth.uid(), 'group', p_group_id, now());
    end if;
  end if;
end;
$$;

grant execute on function public.mark_chat_read(text, uuid, uuid) to authenticated;

create or replace function public.chat_unread_counts()
returns table (room text, peer_id uuid, group_id uuid, unread bigint)
language sql
security definer
stable
set search_path = public
as $$
  select 'family'::text, null::uuid, null::uuid,
    (
      select count(*)::bigint from public.chat_messages m
      where m.room = 'family' and m.sender_id <> auth.uid()
        and m.created_at > coalesce(
          (select r.last_read_at from public.chat_reads r
           where r.user_id = auth.uid() and r.room = 'family' limit 1),
          '1970-01-01'::timestamptz)
    )
  union all
  select 'dm', x.other_id, null::uuid, x.cnt
  from (
    select
      case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end as other_id,
      count(*) filter (
        where m.sender_id <> auth.uid()
          and m.created_at > coalesce(
            (select r.last_read_at from public.chat_reads r
             where r.user_id = auth.uid() and r.room = 'dm'
               and r.peer_id = case when m.sender_id = auth.uid() then m.recipient_id else m.sender_id end),
            '1970-01-01'::timestamptz)
      )::bigint as cnt
    from public.chat_messages m
    where m.room = 'dm' and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    group by 1
  ) x
  where x.cnt > 0
  union all
  select 'group', null::uuid, m.group_id, count(*)::bigint
  from public.chat_messages m
  join public.chat_group_members gm on gm.group_id = m.group_id and gm.user_id = auth.uid()
  where m.room = 'group' and m.sender_id <> auth.uid()
    and m.created_at > coalesce(
      (select r.last_read_at from public.chat_reads r
       where r.user_id = auth.uid() and r.room = 'group' and r.group_id = m.group_id),
      '1970-01-01'::timestamptz)
  group by m.group_id
  having count(*) > 0;
$$;

grant execute on function public.chat_unread_counts() to authenticated;

-- 8. Realtime
do $$ begin alter publication supabase_realtime add table public.chat_messages; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_reactions; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_calls; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_groups; exception when others then null; end $$;

-- 9. Storage for voice notes + attachments
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read" on storage.objects
  for select using (bucket_id = 'uploads');

drop policy if exists "uploads_insert_own" on storage.objects;
create policy "uploads_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'uploads'
    and auth.uid() is not null
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] = 'chat'
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

drop policy if exists "uploads_admin_all" on storage.objects;
create policy "uploads_admin_all" on storage.objects
  for all using (bucket_id = 'uploads' and public.is_admin())
  with check (bucket_id = 'uploads' and public.is_admin());

notify pgrst, 'reload schema';
