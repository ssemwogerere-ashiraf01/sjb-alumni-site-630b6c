-- =========================================================================
-- FIX: candidates.html / vote.html showing blank names and photos for
-- non-admin members. Same root cause as the leadership.html fix (008):
-- joining candidates -> profiles directly hits profiles RLS, which only
-- lets someone read their OWN row (or an admin read anyone's). A regular
-- member browsing the ballot got nulled-out names for every candidate
-- except themselves.
--
-- Fix: a narrow, security-definer function returning only what a ballot
-- needs to render (name, photo, manifesto, position) — nothing else from
-- profiles. Gated to approved members / admins via a WHERE clause, so an
-- unapproved caller just gets zero rows rather than an error.
--
-- Run after 001-008.
-- =========================================================================
create or replace function public.election_candidate_cards(p_election_id uuid)
returns table(
  candidate_id uuid,
  position text,
  manifesto text,
  photo_url text,
  full_name text,
  profile_photo_url text
)
language sql
security definer
stable
as $$
  select c.id as candidate_id, c.position, c.manifesto, c.photo_url,
         p.full_name, p.profile_photo_url
  from public.candidates c
  join public.profiles p on p.id = c.user_id
  where c.election_id = p_election_id
    and c.approved = true
    and (public.is_approved_member() or public.is_admin());
$$;
