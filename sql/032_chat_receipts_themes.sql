-- Helper: peer read receipt for DMs
create or replace function public.dm_peer_last_read(p_peer_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select r.last_read_at
  from public.chat_reads r
  where r.user_id = p_peer_id
    and r.room = 'dm'
    and r.peer_id = auth.uid()
  limit 1;
$$;

grant execute on function public.dm_peer_last_read(uuid) to authenticated;

-- Peer online signal from last_seen
create or replace function public.profile_last_seen(p_user_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select last_seen_at from public.profiles where id = p_user_id;
$$;

grant execute on function public.profile_last_seen(uuid) to authenticated;

notify pgrst, 'reload schema';
