-- Allow admins to delete contact messages
drop policy if exists "contact_delete_admin" on public.contact_messages;
create policy "contact_delete_admin" on public.contact_messages
  for delete using (public.is_admin());
