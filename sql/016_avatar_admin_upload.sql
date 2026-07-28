-- =========================================================================
-- 016. Allow admins / super admin to upload avatars for any member.
-- Members still use their own folder; admins can write any path in "avatars".
-- Run in Supabase SQL Editor after 003_storage.sql.
-- =========================================================================

drop policy if exists "avatar_admin_insert" on storage.objects;
create policy "avatar_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "avatar_admin_update" on storage.objects;
create policy "avatar_admin_update"
  on storage.objects for update
  using (bucket_id = 'avatars' and public.is_admin());

drop policy if exists "avatar_admin_delete" on storage.objects;
create policy "avatar_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'avatars' and public.is_admin());
