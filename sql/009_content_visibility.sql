-- =========================================================================
-- CONTENT VISIBILITY FLAGS
-- Add a consistent publish/active switch to the content tables that are
-- shown to members, then tighten RLS so user-facing pages only read rows
-- that admins have marked active.
-- =========================================================================

alter table public.news add column if not exists is_active boolean not null default true;
alter table public.events add column if not exists is_active boolean not null default true;
alter table public.jobs add column if not exists is_active boolean not null default true;
alter table public.forum_topics add column if not exists content text null;
alter table public.forum_topics add column if not exists is_active boolean not null default true;
alter table public.forum_replies add column if not exists is_active boolean not null default true;
alter table public.savings_announcements add column if not exists is_active boolean not null default true;

drop policy if exists "news_public_read" on public.news;
create policy "news_public_read" on public.news for select using (is_active or public.is_admin());

drop policy if exists "events_public_read" on public.events;
create policy "events_public_read" on public.events for select using (is_active or public.is_admin());

drop policy if exists "jobs_public_read" on public.jobs;
create policy "jobs_public_read" on public.jobs for select using (is_active or public.is_admin());

drop policy if exists "forum_topics_read_members" on public.forum_topics;
create policy "forum_topics_read_members" on public.forum_topics for select using ((is_active and public.is_approved_member()) or public.is_admin());

drop policy if exists "forum_replies_read_members" on public.forum_replies;
create policy "forum_replies_read_members" on public.forum_replies for select using ((is_active and public.is_approved_member()) or public.is_admin());

drop policy if exists "savings_announcements_read" on public.savings_announcements;
create policy "savings_announcements_read" on public.savings_announcements for select using (
  public.is_admin()
  or (is_active and group_id is null)
  or (is_active and exists (
    select 1 from public.savings_group_members m
    where m.group_id = savings_announcements.group_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  ))
);