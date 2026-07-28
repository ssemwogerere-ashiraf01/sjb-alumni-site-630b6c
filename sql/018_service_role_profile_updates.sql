-- =========================================================================
-- 018. Allow service_role (Edge Functions) to update sensitive profile fields
--
-- verify-flutterwave uses the service role key to set membership_fee_paid
-- after a successful Flutterwave charge. Triggers still run for service_role,
-- and protect_sensitive_profile_fields() only allowed is_admin() — so auth.uid()
-- was null and the update failed with:
--   "Only admins can modify sensitive profile fields"
--
-- Run this once in the Supabase SQL Editor, then retry payment verification.
-- =========================================================================

create or replace function public.protect_sensitive_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Edge Functions / service role may update any profile columns.
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if new.is_super_admin is distinct from old.is_super_admin and not public.is_super_admin() then
    raise exception 'Only the super admin can grant or revoke super admin status';
  end if;

  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.membership_class is distinct from old.membership_class
     or new.membership_fee_paid is distinct from old.membership_fee_paid
     or new.membership_fee_paid_at is distinct from old.membership_fee_paid_at
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.failed_login_count is distinct from old.failed_login_count
     or new.locked_until is distinct from old.locked_until
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  return new;
end;
$$;
