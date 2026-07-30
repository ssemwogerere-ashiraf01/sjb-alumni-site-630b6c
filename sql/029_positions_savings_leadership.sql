-- Positions catalog + savings-group leadership support

create table if not exists public.leadership_positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  scope text not null check (scope in ('association', 'savings_group')),
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  unique (scope, name)
);

alter table public.leadership_positions enable row level security;

drop policy if exists "lp_public_read" on public.leadership_positions;
create policy "lp_public_read" on public.leadership_positions
  for select using (true);

drop policy if exists "lp_admin_write" on public.leadership_positions;
create policy "lp_admin_write" on public.leadership_positions
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.leadership_positions (name, scope, display_order) values
  ('Chairperson', 'association', 1),
  ('Vice Chairperson', 'association', 2),
  ('Secretary', 'association', 3),
  ('Treasurer', 'association', 4),
  ('Publicity Secretary', 'association', 5),
  ('Committee Member', 'association', 10),
  ('Group Chairperson', 'savings_group', 1),
  ('Group Secretary', 'savings_group', 2),
  ('Group Treasurer', 'savings_group', 3),
  ('Group Mobilizer', 'savings_group', 4)
on conflict (scope, name) do nothing;

-- Association leaders: group_id is null. Savings group leaders: group_id set.
alter table public.leaders
  add column if not exists group_id uuid references public.savings_groups(id) on delete cascade;

create index if not exists idx_leaders_group on public.leaders(group_id);

-- Elections can target a savings group (null = association-wide alumni leadership)
alter table public.elections
  add column if not exists group_id uuid references public.savings_groups(id) on delete cascade;

create index if not exists idx_elections_group on public.elections(group_id);

-- Restrict voting to group members when election has group_id
create or replace function public.can_vote_in_election(p_election_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.elections e
    where e.id = p_election_id
      and e.status = 'active'
      and now() between e.start_date and e.end_date
      and (
        e.group_id is null
        or exists (
          select 1 from public.savings_group_members m
          where m.group_id = e.group_id
            and m.user_id = auth.uid()
            and m.status = 'active'
        )
      )
  );
$$;

grant execute on function public.can_vote_in_election(uuid) to authenticated;

-- Promote winners into leaders with matching group_id
create or replace function public.promote_election_winners(p_election_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_group uuid;
begin
  select group_id into v_group from public.elections where id = p_election_id;

  for r in
    select ranked.position, ranked.candidate_id, c.user_id
    from (
      select v.position, v.candidate_id, count(*) as vote_count,
             row_number() over (partition by v.position order by count(*) desc) as rnk
      from public.votes v
      where v.election_id = p_election_id
      group by v.position, v.candidate_id
    ) ranked
    join public.candidates c on c.id = ranked.candidate_id
    where ranked.rnk = 1
  loop
    if v_group is null then
      update public.leaders
      set is_current = false, term_end = current_date
      where position = r.position and is_current = true and group_id is null;
      insert into public.leaders (user_id, position, term_start, is_current, display_order, group_id)
      values (r.user_id, r.position, current_date, true, 0, null);
    else
      update public.leaders
      set is_current = false, term_end = current_date
      where position = r.position and is_current = true and group_id = v_group;
      insert into public.leaders (user_id, position, term_start, is_current, display_order, group_id)
      values (r.user_id, r.position, current_date, true, 0, v_group);
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
