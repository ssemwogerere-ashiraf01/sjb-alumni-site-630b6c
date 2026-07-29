-- Election edit helpers + reset (clear votes even though votes have no DELETE policy for clients)

create or replace function public.reset_election(p_election_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_deleted int;
begin
  if not public.is_super_admin() and not public.is_admin() then
    raise exception 'Only admins can reset elections';
  end if;

  select title into v_title from public.elections where id = p_election_id;
  if v_title is null then
    raise exception 'Election not found';
  end if;

  delete from public.votes where election_id = p_election_id;
  get diagnostics v_deleted = row_count;

  update public.elections
  set status = 'upcoming'
  where id = p_election_id;

  -- Soft-clear leadership tied to this election if column exists
  begin
    update public.leaders set is_current = false where election_id = p_election_id;
  exception when undefined_column then
    null;
  end;

  return format('Reset "%s": %s votes cleared; status set to upcoming.', v_title, v_deleted);
end;
$$;

grant execute on function public.reset_election(uuid) to authenticated;

notify pgrst, 'reload schema';
