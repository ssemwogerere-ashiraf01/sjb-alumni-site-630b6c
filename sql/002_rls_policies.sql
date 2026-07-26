-- =========================================================================
-- ROW LEVEL SECURITY — this is what actually enforces your rules:
--   "only admins edit sensitive info, users only edit their own profile,
--    savings members must be association members, elections need approval"
-- Run AFTER 001_schema.sql
-- =========================================================================

-- Helper: is the current user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Helper: is the current user an approved, fee-paid member?
create or replace function public.is_approved_member()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and status = 'approved'
      and membership_fee_paid = true
  );
$$ language sql security definer stable;

-- =========================================================================
-- PROFILES
-- =========================================================================
alter table public.profiles enable row level security;

-- Anyone logged in can read their own profile; admins can read all.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Users may UPDATE their own row, but a check constraint-style trigger
-- (below) blocks them from touching sensitive columns themselves.
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

-- Block non-admins from changing role/status/membership_fee_paid/approved_*
-- even on their own row (RLS alone can't do column-level checks on UPDATE,
-- so we enforce it with a trigger).
create or replace function public.protect_sensitive_profile_fields()
returns trigger as $$
begin
  if public.is_admin() then
    return new; -- admins may change anything
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.membership_class is distinct from old.membership_class
     or new.membership_fee_paid is distinct from old.membership_fee_paid
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.failed_login_count is distinct from old.failed_login_count
     or new.locked_until is distinct from old.locked_until
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger protect_sensitive_fields
  before update on public.profiles
  for each row execute procedure public.protect_sensitive_profile_fields();

-- =========================================================================
-- LEADERS / NEWS / EVENTS — public read, admin write
-- =========================================================================
alter table public.leaders enable row level security;
create policy "leaders_public_read" on public.leaders for select using (true);
create policy "leaders_admin_write" on public.leaders for all using (public.is_admin()) with check (public.is_admin());

alter table public.news enable row level security;
create policy "news_public_read" on public.news for select using (true);
create policy "news_admin_write" on public.news for all using (public.is_admin()) with check (public.is_admin());

alter table public.events enable row level security;
create policy "events_public_read" on public.events for select using (true);
create policy "events_admin_write" on public.events for insert with check (public.is_admin());
create policy "events_admin_update" on public.events for update using (public.is_admin());
create policy "events_admin_delete" on public.events for delete using (public.is_admin());

alter table public.event_registrations enable row level security;
create policy "event_reg_own" on public.event_registrations for select using (user_id = auth.uid() or public.is_admin());
create policy "event_reg_insert_own" on public.event_registrations for insert with check (user_id = auth.uid() and public.is_approved_member());
create policy "event_reg_admin_manage" on public.event_registrations for update using (public.is_admin());

-- =========================================================================
-- PAYMENTS — users see only their own; ONLY the server (service role, via
-- Edge Function) can mark a payment "completed". Client can only INSERT
-- a pending row (to record intent) and READ their own history.
-- =========================================================================
alter table public.payments enable row level security;
create policy "payments_select_own_or_admin" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments_insert_own_pending" on public.payments for insert
  with check (user_id = auth.uid() and status = 'pending');
-- NOTE: no UPDATE policy for regular users at all — verification/status
-- changes happen exclusively via the Edge Function using the service_role
-- key, which bypasses RLS entirely. This is intentional and important:
-- it stops a user from marking their own payment "completed" client-side.

-- =========================================================================
-- SAVINGS — must be an approved association member to even see groups;
-- can only view/act on group data once an ACTIVE member of that group.
-- =========================================================================
alter table public.savings_groups enable row level security;
create policy "savings_groups_read_members" on public.savings_groups
  for select using (public.is_approved_member() or public.is_admin());
create policy "savings_groups_admin_write" on public.savings_groups
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.savings_group_members enable row level security;
-- A member can see the roster of groups they belong to; admins see all.
create policy "sgm_select" on public.savings_group_members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.savings_group_members m2
               where m2.group_id = savings_group_members.group_id
                 and m2.user_id = auth.uid() and m2.status = 'active')
  );
-- Registering for a savings group (the ONE savings page non-members may hit)
-- requires approved association membership; row starts 'pending' for admin approval.
create policy "sgm_insert_own" on public.savings_group_members
  for insert with check (user_id = auth.uid() and public.is_approved_member());
create policy "sgm_admin_manage" on public.savings_group_members
  for update using (public.is_admin());

alter table public.savings_transactions enable row level security;
-- Only ACTIVE members of that specific group can see its transactions —
-- this is the "savings members should not access other savings info" rule.
create policy "savings_txn_select" on public.savings_transactions
  for select using (
    public.is_admin()
    or exists (select 1 from public.savings_group_members m
               where m.group_id = savings_transactions.group_id
                 and m.user_id = auth.uid() and m.status = 'active')
  );
create policy "savings_txn_insert_own" on public.savings_transactions
  for insert with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (select 1 from public.savings_group_members m
                where m.group_id = savings_transactions.group_id
                  and m.user_id = auth.uid() and m.status = 'active')
  );
-- Contribution status flips to 'completed' only via the Flutterwave
-- verification Edge Function (service role). Withdrawal approval flips
-- via admin action.
create policy "savings_txn_admin_update" on public.savings_transactions
  for update using (public.is_admin());

-- =========================================================================
-- ELECTIONS — visible only to logged-in, approved members. Voting enforced
-- one-per-position via the unique constraint; RLS blocks reading who voted
-- for whom (nobody, including admins, gets a select policy on raw votes
-- joined to voters — tallies come from the security-definer function below).
-- =========================================================================
alter table public.elections enable row level security;
create policy "elections_read_members" on public.elections for select using (public.is_approved_member() or public.is_admin());
create policy "elections_admin_write" on public.elections for all using (public.is_admin()) with check (public.is_admin());

alter table public.candidates enable row level security;
create policy "candidates_read_members" on public.candidates for select using (public.is_approved_member() or public.is_admin());
create policy "candidates_admin_write" on public.candidates for all using (public.is_admin()) with check (public.is_admin());

alter table public.votes enable row level security;
-- Users can INSERT their own vote once, and check *whether* they've voted
-- (select only their own row) — never anyone else's, never candidate tallies.
create policy "votes_insert_own" on public.votes
  for insert with check (voter_id = auth.uid() and public.is_approved_member());
create policy "votes_select_own_only" on public.votes
  for select using (voter_id = auth.uid());
-- No update/delete policy for anyone (including admins) => votes are immutable.

-- Public tally function: returns counts only, never who-voted-for-whom.
create or replace function public.election_results(p_election_id uuid)
returns table(candidate_id uuid, position text, vote_count bigint)
language sql security definer stable as $$
  select candidate_id, position, count(*) as vote_count
  from public.votes
  where election_id = p_election_id
  group by candidate_id, position;
$$;

-- =========================================================================
-- LOGIN ATTEMPTS / AUDIT LOG — service role only (written by Edge
-- Functions / auth hooks, never directly by the client)
-- =========================================================================
alter table public.login_attempts enable row level security;
create policy "login_attempts_admin_read" on public.login_attempts for select using (public.is_admin());
-- No insert policy for the anon/authenticated role — only service_role
-- (which bypasses RLS) writes here, from the login Edge Function.

alter table public.audit_log enable row level security;
create policy "audit_log_admin_read" on public.audit_log for select using (public.is_admin());

-- =========================================================================
-- APP SETTINGS — everyone can read (e.g. frontend needs the fee amount
-- before login), only admins can change it.
-- =========================================================================
alter table public.app_settings enable row level security;
create policy "app_settings_public_read" on public.app_settings for select using (true);
create policy "app_settings_admin_write" on public.app_settings for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================================
-- DONATIONS — same pattern as payments: user inserts a pending intent,
-- only the Edge Function (service_role) marks it completed.
-- =========================================================================
alter table public.donations enable row level security;
create policy "donations_select_own_or_admin" on public.donations for select using (user_id = auth.uid() or public.is_admin());
create policy "donations_insert_own_pending" on public.donations for insert with check (user_id = auth.uid() and status = 'pending');

-- =========================================================================
-- FORUM — any approved member can start topics/reply; admins moderate.
-- =========================================================================
alter table public.forum_topics enable row level security;
create policy "forum_topics_read_members" on public.forum_topics for select using (public.is_approved_member() or public.is_admin());
create policy "forum_topics_insert_members" on public.forum_topics for insert with check (author_id = auth.uid() and public.is_approved_member());
create policy "forum_topics_admin_moderate" on public.forum_topics for update using (public.is_admin());
create policy "forum_topics_admin_delete" on public.forum_topics for delete using (public.is_admin());

alter table public.forum_replies enable row level security;
create policy "forum_replies_read_members" on public.forum_replies for select using (public.is_approved_member() or public.is_admin());
create policy "forum_replies_insert_members" on public.forum_replies for insert with check (
  author_id = auth.uid() and public.is_approved_member()
  and not exists (select 1 from public.forum_topics t where t.id = topic_id and t.is_locked)
);
create policy "forum_replies_admin_delete" on public.forum_replies for delete using (public.is_admin());

-- =========================================================================
-- NEWSLETTER SUBSCRIBERS — public can subscribe (no login required),
-- only admins can read the list.
-- =========================================================================
alter table public.subscribers enable row level security;
create policy "subscribers_public_insert" on public.subscribers for insert with check (true);
create policy "subscribers_admin_read" on public.subscribers for select using (public.is_admin());

-- =========================================================================
-- JOB BOARD — public read (good for the pre-login marketing pages too),
-- approved members can post, admins moderate.
-- =========================================================================
alter table public.jobs enable row level security;
create policy "jobs_public_read" on public.jobs for select using (true);
create policy "jobs_insert_members" on public.jobs for insert with check (posted_by = auth.uid() and public.is_approved_member());
create policy "jobs_admin_manage" on public.jobs for update using (public.is_admin());
create policy "jobs_admin_delete" on public.jobs for delete using (public.is_admin());

-- =========================================================================
-- CHAPTERS — public read, admin write; members can see/join rosters.
-- =========================================================================
alter table public.chapters enable row level security;
create policy "chapters_public_read" on public.chapters for select using (true);
create policy "chapters_admin_write" on public.chapters for all using (public.is_admin()) with check (public.is_admin());

alter table public.chapter_members enable row level security;
create policy "chapter_members_read" on public.chapter_members for select using (user_id = auth.uid() or public.is_admin());
create policy "chapter_members_insert_own" on public.chapter_members for insert with check (user_id = auth.uid() and public.is_approved_member());
create policy "chapter_members_admin_manage" on public.chapter_members for delete using (public.is_admin());

-- =========================================================================
-- SAVINGS ANNOUNCEMENTS — visible only to active members of that group
-- (or all approved members if group_id is null, i.e. association-wide).
-- =========================================================================
alter table public.savings_announcements enable row level security;
create policy "savings_announcements_read" on public.savings_announcements for select using (
  public.is_admin()
  or group_id is null
  or exists (select 1 from public.savings_group_members m
             where m.group_id = savings_announcements.group_id
               and m.user_id = auth.uid() and m.status = 'active')
);
create policy "savings_announcements_admin_write" on public.savings_announcements for all using (public.is_admin()) with check (public.is_admin());
