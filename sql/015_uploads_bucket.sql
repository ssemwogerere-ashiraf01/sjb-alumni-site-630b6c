insert into storage.buckets (id, name, public) values ('uploads', 'uploads', true) on conflict (id) do update set public = true;
drop policy if exists "uploads_public_read" on storage.objects;
create policy "uploads_public_read" on storage.objects for select using (bucket_id = 'uploads');
drop policy if exists "uploads_insert_own" on storage.objects;
create policy "uploads_insert_own" on storage.objects for insert with check (bucket_id = 'uploads' and auth.uid() is not null and ((storage.foldername(name))[1] = auth.uid()::text or (storage.foldername(name))[2] = auth.uid()::text));
drop policy if exists "uploads_admin_all" on storage.objects;
create policy "uploads_admin_all" on storage.objects for all using (bucket_id = 'uploads' and public.is_admin()) with check (bucket_id = 'uploads' and public.is_admin());
