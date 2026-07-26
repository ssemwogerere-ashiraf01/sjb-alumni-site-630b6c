-- =========================================================================
-- ONBOARDING SUPPORT
--
-- Fixes a real conflict: membership_class was on the "sensitive, admin-only"
-- protected list, but new members are supposed to self-declare it (alumni
-- vs non-alumni) right after signing up. Google OAuth signups never got
-- asked at all. This adds a one-time onboarding step for every signup
-- method, and lets a user set membership_class exactly once (before their
-- onboarding is marked complete) — after that, only an admin can change it.
--
-- Run after 001-006.
-- =========================================================================
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

create or replace function public.protect_sensitive_profile_fields()
returns trigger as $$
begin
  if public.is_admin() then
    return new; -- admins may change anything
  end if;

  -- membership_class may be self-set exactly once, during onboarding.
  -- Once onboarding_completed was already true, it locks like the others.
  if new.membership_class is distinct from old.membership_class
     and old.onboarding_completed = true
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
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
