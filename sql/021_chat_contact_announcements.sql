-- Contact form, member chat, and marquee announcements
-- Run in Supabase SQL Editor after prior migrations.

-- Contact messages from the public contact form
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  topic text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "contact_insert_anyone" on public.contact_messages;
create policy "contact_insert_anyone" on public.contact_messages
  for insert with check (true);

drop policy if exists "contact_select_admin" on public.contact_messages;
create policy "contact_select_admin" on public.contact_messages
  for select using (public.is_admin());

drop policy if exists "contact_update_admin" on public.contact_messages;
create policy "contact_update_admin" on public.contact_messages
  for update using (public.is_admin());

-- Marquee / live updates under the header
create table if not exists public.site_announcements (
  id uuid primary key default gen_random_uuid(),
  message text not null,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.site_announcements enable row level security;

drop policy if exists "announcements_public_read" on public.site_announcements;
create policy "announcements_public_read" on public.site_announcements
  for select using (is_active = true or public.is_admin());

drop policy if exists "announcements_admin_write" on public.site_announcements;
create policy "announcements_admin_write" on public.site_announcements
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.site_announcements (message, display_order) values
  ('Welcome to SJB Association — save together, vote together, show up for one another.', 1),
  ('Membership is by approval. Register, await review, then pay your membership fee.', 2),
  ('Join savings groups, vote in elections, and use the member job board and forums.', 3)
on conflict do nothing;

-- Member chat: family room + DMs
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room text not null check (room in ('family', 'dm')),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  check (
    (room = 'family' and recipient_id is null) or
    (room = 'dm' and recipient_id is not null)
  )
);

create index if not exists idx_chat_room_created on public.chat_messages(room, created_at);
create index if not exists idx_chat_dm_pair on public.chat_messages(sender_id, recipient_id);

alter table public.chat_messages enable row level security;

-- Approved members can read family room
drop policy if exists "chat_family_select" on public.chat_messages;
create policy "chat_family_select" on public.chat_messages
  for select using (
    public.is_admin()
    or (
      public.is_approved_member()
      and (
        room = 'family'
        or sender_id = auth.uid()
        or recipient_id = auth.uid()
      )
    )
  );

drop policy if exists "chat_insert_members" on public.chat_messages;
create policy "chat_insert_members" on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and public.is_approved_member()
    and (
      (room = 'family' and recipient_id is null)
      or (room = 'dm' and recipient_id is not null and recipient_id <> auth.uid())
    )
  );

-- Optional: enable Realtime for chat_messages in Dashboard → Database → Replication
