-- =========================================================================
-- Auto-promotes election winners into public.leaders (which the landing
-- page and any "Leadership" section reads from). Called by the admin
-- panel the moment an election's status is set to 'closed'.
-- Run after 001/002/003/004.
-- =========================================================================
create or replace function public.promote_election_winners(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.is_admin() then
    raise exception 'Only admins can promote election winners.';
  end if;

  -- For each position, take the candidate with the most votes (ties are
  -- broken arbitrarily by row order — worth a manual look if a position
  -- is genuinely tied).
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
    -- Retire whoever currently holds that position
    update public.leaders
    set is_current = false, term_end = current_date
    where position = r.position and is_current = true;

    insert into public.leaders (user_id, position, term_start, is_current, display_order)
    values (r.user_id, r.position, current_date, true, 0);
  end loop;
end;
$$;
