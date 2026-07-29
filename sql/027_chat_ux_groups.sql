-- Chat UX: edit/delete messages, group settings, invites, themes
alter table public.chat_messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

alter table public.chat_groups
  add column if not exists rules text,
  add column if not exists only_admins_can_post boolean not null default false,
  add column if not exists members_can_edit_info boolean not null default false;

-- Pending invites (member must accept)
create table if not exists public.chat_group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.chat_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

alter table public.chat_group_invites enable row level security;

drop policy if exists "cgi_select" on public.chat_group_invites;
create policy "cgi_select" on public.chat_group_invites for select using (
  user_id = auth.uid() or invited_by = auth.uid() or public.is_chat_group_admin(group_id) or public.is_admin()
);
drop policy if exists "cgi_insert" on public.chat_group_invites;
create policy "cgi_insert" on public.chat_group_invites for insert with check (
  invited_by = auth.uid() and public.is_chat_group_admin(group_id)
);
drop policy if exists "cgi_update" on public.chat_group_invites;
create policy "cgi_update" on public.chat_group_invites for update using (
  user_id = auth.uid() or public.is_chat_group_admin(group_id)
);

-- Allow sender to update own messages (edit / soft-delete)
drop policy if exists "chat_update_own" on public.chat_messages;
create policy "chat_update_own" on public.chat_messages for update using (
  sender_id = auth.uid()
) with check (
  sender_id = auth.uid()
);

-- Per-user chat theme preference (localStorage primary; optional DB)
create table if not exists public.chat_user_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  background text,
  updated_at timestamptz not null default now()
);
alter table public.chat_user_prefs enable row level security;
drop policy if exists "cup_own" on public.chat_user_prefs;
create policy "cup_own" on public.chat_user_prefs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

notify pgrst, 'reload schema';

do $$ begin alter publication supabase_realtime add table public.chat_calls; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.chat_group_invites; exception when others then null; end $$;

