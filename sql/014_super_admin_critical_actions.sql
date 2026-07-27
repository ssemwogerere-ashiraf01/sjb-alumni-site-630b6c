-- =========================================================================
-- 014. SUPER-ADMIN-ONLY CRITICAL ACTIONS
--
-- Extends the super-admin tier introduced in 013 to a second area:
-- the "heavy" write actions across Content (news/events/jobs/forum/
-- savings announcements), Savings Groups, Savings Approvals, Withdrawals
-- (financials), Elections/Candidates, and Feedback Forms.
--
-- Rule applied uniformly:
--   - CREATE (insert)              -> any admin (is_admin(), incl. super admin)
--   - EDIT / STATUS CHANGE (update) -> super admin only (is_super_admin())
--   - DELETE                        -> super admin only (is_super_admin())
--
-- Regular admins keep read access to everything and can still create new
-- posts, groups, elections, candidates, and feedback forms — those are
-- the "non-critical" tasks they retain. Approving/rejecting/activating/
-- editing/deleting existing records now requires the super admin.
--
-- Member approval/suspension/kick/reactivate (public.profiles) is
-- deliberately NOT touched here — that stays a regular-admin task, same
-- as before 013.
--
-- Run AFTER 001-013.
-- =========================================================================

-- -------------------------------------------------------------------------
-- CONTENT: news, events, jobs, forum topics/replies, savings announcements
-- -------------------------------------------------------------------------

-- news (previously a single "for all" policy)
drop policy if exists "news_admin_write" on public.news;
create policy "news_admin_insert" on public.news for insert with check (public.is_admin());
create policy "news_super_admin_update" on public.news for update using (public.is_super_admin());
create policy "news_super_admin_delete" on public.news for delete using (public.is_super_admin());

-- events
drop policy if exists "events_admin_update" on public.events;
drop policy if exists "events_admin_delete" on public.events;
create policy "events_super_admin_update" on public.events for update using (public.is_super_admin());
create policy "events_super_admin_delete" on public.events for delete using (public.is_super_admin());
-- events_admin_write (insert) is untouched — admins can still post events.

-- jobs
drop policy if exists "jobs_admin_manage" on public.jobs;
drop policy if exists "jobs_admin_delete" on public.jobs;
create policy "jobs_super_admin_update" on public.jobs for update using (public.is_super_admin());
create policy "jobs_super_admin_delete" on public.jobs for delete using (public.is_super_admin());
-- jobs_insert_members (insert) is untouched.

-- forum topics/replies — admins moderate/delete; members still post their own.
drop policy if exists "forum_topics_admin_moderate" on public.forum_topics;
drop policy if exists "forum_topics_admin_delete" on public.forum_topics;
create policy "forum_topics_super_admin_moderate" on public.forum_topics for update using (public.is_super_admin());
create policy "forum_topics_super_admin_delete" on public.forum_topics for delete using (public.is_super_admin());

drop policy if exists "forum_replies_admin_delete" on public.forum_replies;
create policy "forum_replies_super_admin_delete" on public.forum_replies for delete using (public.is_super_admin());

-- savings announcements (a "post" type, association or per-group)
drop policy if exists "savings_announcements_admin_write" on public.savings_announcements;
create policy "savings_announcements_admin_insert" on public.savings_announcements for insert with check (public.is_admin());
create policy "savings_announcements_super_admin_update" on public.savings_announcements for update using (public.is_super_admin());
create policy "savings_announcements_super_admin_delete" on public.savings_announcements for delete using (public.is_super_admin());

-- -------------------------------------------------------------------------
-- SAVINGS GROUPS — creating a group stays with any admin; editing
-- (renaming, changing contribution/join-fee amounts, activating/
-- deactivating) and deleting a group is super-admin only.
-- -------------------------------------------------------------------------
drop policy if exists "savings_groups_admin_write" on public.savings_groups;
create policy "savings_groups_admin_insert" on public.savings_groups for insert with check (public.is_admin());
create policy "savings_groups_super_admin_update" on public.savings_groups for update using (public.is_super_admin());
create policy "savings_groups_super_admin_delete" on public.savings_groups for delete using (public.is_super_admin());

-- -------------------------------------------------------------------------
-- SAVINGS APPROVALS — activating a member's pending group registration
-- (savings_group_members.status pending -> active/removed) is a financial
-- gatekeeping action, now super-admin only.
-- -------------------------------------------------------------------------
drop policy if exists "sgm_admin_manage" on public.savings_group_members;
create policy "sgm_super_admin_manage" on public.savings_group_members for update using (public.is_super_admin());

-- -------------------------------------------------------------------------
-- FINANCIALS — approving/rejecting withdrawals (and any other admin edit
-- of a savings transaction) is super-admin only.
-- -------------------------------------------------------------------------
drop policy if exists "savings_txn_admin_update" on public.savings_transactions;
create policy "savings_txn_super_admin_update" on public.savings_transactions for update using (public.is_super_admin());

-- -------------------------------------------------------------------------
-- ELECTIONS & CANDIDATES — creating an election / adding a candidate stays
-- with any admin; editing dates, changing election status (including the
-- close-and-promote-winners step), approving/unapproving candidates, and
-- deleting either is super-admin only.
-- -------------------------------------------------------------------------
drop policy if exists "elections_admin_write" on public.elections;
create policy "elections_admin_insert" on public.elections for insert with check (public.is_admin());
create policy "elections_super_admin_update" on public.elections for update using (public.is_super_admin());
create policy "elections_super_admin_delete" on public.elections for delete using (public.is_super_admin());

drop policy if exists "candidates_admin_write" on public.candidates;
create policy "candidates_admin_insert" on public.candidates for insert with check (public.is_admin());
create policy "candidates_super_admin_update" on public.candidates for update using (public.is_super_admin());
create policy "candidates_super_admin_delete" on public.candidates for delete using (public.is_super_admin());

-- Closing an election (and the automatic winner promotion that follows)
-- is one of the most consequential actions in the whole app, so lock the
-- RPC itself to the super admin as well — defense in depth beyond the RLS
-- policy above.
create or replace function public.promote_election_winners(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can close an election and promote winners.';
  end if;

  for r in
    select ranked.position, ranked.candidate_id, c.user_id
    from (
      select position, candidate_id, vote_count,
             row_number() over (partition by position order by vote_count desc) as rnk
      from public.election_results(p_election_id)
    ) ranked
    join public.candidates c on c.id = ranked.candidate_id
    where ranked.rnk = 1
  loop
    update public.leaders
    set is_current = false, term_end = current_date
    where position = r.position and is_current = true;

    insert into public.leaders (user_id, position, term_start, is_current, display_order)
    values (r.user_id, r.position, current_date, true, 0);
  end loop;
end;
$$;

-- -------------------------------------------------------------------------
-- FEEDBACK FORMS — feedback_forms / feedback_questions were created
-- directly in the Supabase dashboard (see 012) and their original policy
-- names aren't in source control, so rather than guess-and-drop them, add
-- RESTRICTIVE policies. A restrictive policy is ANDed with every permissive
-- one for that command, so no matter what the original "admin can write"
-- policy was called, UPDATE/DELETE on the form definition and its
-- questions now additionally requires is_super_admin() — creating a new
-- form or adding a question (INSERT) is unaffected, and member responses/
-- answers (feedback_responses / feedback_answers) are untouched.
-- -------------------------------------------------------------------------
drop policy if exists "feedback_forms_super_admin_gate" on public.feedback_forms;
create policy "feedback_forms_super_admin_gate" on public.feedback_forms
  as restrictive for update using (public.is_super_admin());
drop policy if exists "feedback_forms_super_admin_delete_gate" on public.feedback_forms;
create policy "feedback_forms_super_admin_delete_gate" on public.feedback_forms
  as restrictive for delete using (public.is_super_admin());

drop policy if exists "feedback_questions_super_admin_gate" on public.feedback_questions;
create policy "feedback_questions_super_admin_gate" on public.feedback_questions
  as restrictive for update using (public.is_super_admin());
drop policy if exists "feedback_questions_super_admin_delete_gate" on public.feedback_questions;
create policy "feedback_questions_super_admin_delete_gate" on public.feedback_questions
  as restrictive for delete using (public.is_super_admin());
