-- Optional helper: mark fee paid by tx_ref (callable only with service role)
create or replace function public.mark_membership_fee_paid(p_user_id uuid, p_tx_ref text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Only service role can mark membership fee paid via this function';
  end if;

  update public.profiles
  set membership_fee_paid = true,
      membership_fee_paid_at = now()
  where id = p_user_id;

  update public.payments
  set status = 'completed',
      verified_at = now()
  where tx_ref = p_tx_ref and user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.mark_membership_fee_paid(uuid, text) from public;
grant execute on function public.mark_membership_fee_paid(uuid, text) to service_role;
