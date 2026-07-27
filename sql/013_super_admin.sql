-- =========================================================================
-- 013. SUPER ADMIN TIER
--
-- Adds a tier above 'admin': exactly one designated super admin
-- (ssemwogerere.ashraf117@gmail.com), who is the only account allowed to:
--   - change anyone's role (promote/demote member <-> leader <-> admin)
--   - permanently delete a member's account
--   - grant/revoke super-admin status itself
--
-- Regular admins keep everything they already had (approve/reject/suspend/
-- kick members, manage news/events/jobs/forum/elections/savings, etc.) —
-- this migration only takes away role changes + permanent deletion from
-- them and reserves those two things for the super admin.
--
-- Run AFTER 001_schema.sql and 002_rls_policies.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Column: is_super_admin
-- -------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

comment on column public.profiles.is_super_admin is
  'True only for the one designated super admin. Grants exclusive rights to change roles and permanently delete accounts. Managed by trigger + this migration, never by regular admin UI.';

-- -------------------------------------------------------------------------
-- 2. Helper: is the current user THE super admin?
-- -------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_super_admin = true
  );
$$ language sql security definer stable;

-- -------------------------------------------------------------------------
-- 3. is_admin() now also recognizes the super admin, so every existing
--    admin-gated policy/page keeps working for them without changes.
-- -------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (role = 'admin' or is_super_admin = true)
  );
$$ language sql security definer stable;

-- -------------------------------------------------------------------------
-- 4. Lock the designated email to super admin on every insert/update, so
--    it can never be demoted, suspended, or have the flag stripped —
--    even by another admin, a buggy edge function, or a direct SQL update
--    that isn't running as the Postgres superuser.
-- -------------------------------------------------------------------------
create or replace function public.enforce_designated_super_admin()
returns trigger as $$
begin
  if lower(new.email) = 'ssemwogerere.ashraf117@gmail.com' then
    new.is_super_admin      := true;
    new.role                := 'admin';
    new.status              := 'approved';
    new.membership_fee_paid := true;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_designated_super_admin_trg on public.profiles;
create trigger enforce_designated_super_admin_trg
  before insert or update on public.profiles
  for each row execute procedure public.enforce_designated_super_admin();

-- Promote them right now if their profile row already exists.
update public.profiles
set is_super_admin = true, role = 'admin', status = 'approved', membership_fee_paid = true
where lower(email) = 'ssemwogerere.ashraf117@gmail.com';

-- -------------------------------------------------------------------------
-- 5. Tighten protect_sensitive_profile_fields:
--      - the `role` column can now only be changed by the super admin
--      - the `is_super_admin` column can only be changed by the super admin
--    Everything a regular admin could already touch (status, fee paid,
--    approved_by/at, lockout fields) is unchanged.
-- -------------------------------------------------------------------------
create or replace function public.protect_sensitive_profile_fields()
returns trigger as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin and not public.is_super_admin() then
    raise exception 'Only the super admin can grant or revoke super admin status';
  end if;

  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'Only the super admin can change a member''s role';
  end if;

  if public.is_admin() then
    return new; -- admins (incl. the super admin) may change the rest freely
  end if;

  if new.status is distinct from old.status
     or new.membership_class is distinct from old.membership_class
     or new.membership_fee_paid is distinct from old.membership_fee_paid
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.failed_login_count is distinct from old.failed_login_count
     or new.locked_until is distinct from old.locked_until
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- -------------------------------------------------------------------------
-- 6. Deletion: only the super admin may delete a profile row directly.
--    (Actual account deletion goes through the admin-delete-user Edge
--    Function using the service-role key, which bypasses RLS — that
--    function independently checks is_super_admin() before calling
--    auth.admin.deleteUser(). This policy is defense-in-depth for any
--    direct table access.)
-- -------------------------------------------------------------------------
drop policy if exists "profiles_delete_super_admin_only" on public.profiles;
create policy "profiles_delete_super_admin_only"
  on public.profiles for delete
  using (public.is_super_admin());
