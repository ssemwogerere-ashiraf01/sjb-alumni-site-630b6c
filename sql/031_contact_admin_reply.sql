-- Admin replies on contact messages
alter table public.contact_messages
  add column if not exists admin_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists replied_by uuid references public.profiles(id) on delete set null;

-- Optional: allow sender to see status of their own messages later
drop policy if exists "contact_select_own" on public.contact_messages;
create policy "contact_select_own" on public.contact_messages
  for select using (auth.uid() is not null and user_id = auth.uid());
