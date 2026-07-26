-- =========================================================================
-- Closes a gap in the original votes_insert_own policy: it only checked
-- that the voter was an approved member, not that the election was
-- actually open. Without this, someone could still insert a vote row
-- directly via the API before an election opens or after it closes.
-- Run after 001/002/003.
-- =========================================================================
drop policy if exists "votes_insert_own" on public.votes;

create policy "votes_insert_own" on public.votes
  for insert with check (
    voter_id = auth.uid()
    and public.is_approved_member()
    and exists (
      select 1 from public.elections e
      where e.id = election_id
        and e.status = 'active'
        and now() between e.start_date and e.end_date
    )
    and exists (
      select 1 from public.candidates c
      where c.id = candidate_id
        and c.election_id = election_id
        and c.position = position
        and c.approved = true
    )
  );
