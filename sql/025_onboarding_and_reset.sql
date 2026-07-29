-- 025: Allow members to complete onboarding + self-edit public profile fields
-- Fixes 018 which blocked membership_class for everyone who is not admin.

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

  -- Self-service fields (always allowed for own row via RLS)
  -- role/status/fees/locks stay protected below.

  -- membership_class: set once during onboarding (before completed flag was true)
  if new.membership_class is distinct from old.membership_class
     and old.onboarding_completed = true
  then
    raise exception 'Only admins can modify sensitive profile fields';
  end if;

  if new.status is distinct from old.status
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

-- Password reset OTP codes (sent via Resend edge function, not Supabase default mail)
create table if not exists public.password_reset_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_codes_email_idx
  on public.password_reset_codes (email, expires_at);

alter table public.password_reset_codes enable row level security;
-- no public policies: only service_role (edge function) touches this table

notify pgrst, 'reload schema';


-- One reaction style per user per message
alter table public.chat_reactions drop constraint if exists chat_reactions_message_id_user_id_emoji_key;
do $$ begin
  alter table public.chat_reactions add constraint chat_reactions_message_user_unique unique (message_id, user_id);
exception when duplicate_object then null;
when unique_violation then null;
end $$;
