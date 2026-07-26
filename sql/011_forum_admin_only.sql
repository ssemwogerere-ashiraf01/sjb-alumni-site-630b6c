-- =========================================================================
-- FORUM TOPIC AUTHORSHIP
-- Forum topics are admin-authored posts. Members may still reply, but they
-- cannot create new topics.
-- =========================================================================

drop policy if exists "forum_topics_insert_members" on public.forum_topics;
create policy "forum_topics_insert_admin" on public.forum_topics
  for insert with check (author_id = auth.uid() and public.is_admin());