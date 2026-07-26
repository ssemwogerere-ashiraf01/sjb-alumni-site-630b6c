-- =========================================================================
-- FIX: "infinite recursion detected in policy for relation
-- savings_group_members"
--
-- Root cause: the sgm_select policy checked "is this user an active member
-- of this same group" by querying savings_group_members directly inside
-- its own USING clause. Postgres has to apply RLS to that inner query too
-- — but the RLS policy being applied IS this same policy, so it tries to
-- evaluate itself to answer itself, forever.
--
-- Fix: move that check into a SECURITY DEFINER function (same pattern as
-- is_admin() / is_approved_member() already used elsewhere). A definer
-- function's internal query runs as the function's owner, which bypasses
-- RLS entirely, so it never re-triggers the calling policy.
--
-- Run after 001-005.
-- =========================================================================
create or replace function public.is_active_group_member(p_group_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.savings_group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

drop policy if exists "sgm_select" on public.savings_group_members;

create policy "sgm_select" on public.savings_group_members
  for select using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_active_group_member(group_id)
  );
