-- =========================================================================
-- AVATAR STORAGE — run in Supabase SQL Editor after 001/002.
-- Safe to re-run: drops each policy first if it already exists.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar_public_read" on storage.objects;
drop policy if exists "avatar_insert_own" on storage.objects;
drop policy if exists "avatar_update_own" on storage.objects;
drop policy if exists "avatar_delete_own" on storage.objects;

-- Anyone can view avatars (they're shown in the nav bar for every logged-in
-- user, and it's normal for a profile photo to be publicly viewable).
create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- A user may only upload/replace/delete files inside a folder named after
-- their own user id, e.g. avatars/<user_id>/photo.jpg — this is what stops
-- one member from overwriting another member's photo.
create policy "avatar_insert_own" on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_update_own" on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_delete_own" on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

