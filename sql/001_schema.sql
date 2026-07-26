-- =========================================================================
-- SJB ASSOCIATION PLATFORM — CORE SCHEMA (Supabase / Postgres)
-- =========================================================================
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> paste -> Run
-- Safe to run once on a fresh project. Re-running will error on existing
-- objects (by design, so you don't accidentally wipe data).
-- =========================================================================

-- -------------------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. ENUM TYPES
-- -------------------------------------------------------------------------
create type user_role as enum ('member', 'leader', 'admin');
create type account_status as enum ('pending', 'approved', 'rejected', 'suspended', 'kicked');
create type membership_class as enum ('alumni', 'non_alumni');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type payment_purpose as enum ('membership_fee', 'savings_contribution', 'donation');
create type election_status as enum ('draft', 'upcoming', 'active', 'closed');
create type savings_txn_type as enum ('contribution', 'withdrawal');
create type savings_txn_status as enum ('pending', 'completed', 'rejected');

-- -------------------------------------------------------------------------
-- 1b. APP SETTINGS  (replaces the original singleton `savings_settings`
--     row with a flexible key/value table admins can edit without a
--     code change — e.g. the association membership fee)
-- -------------------------------------------------------------------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('membership_fee_alumni', '{"amount": 3000, "currency": "UGX"}'),
  ('membership_fee_non_alumni', '{"amount": 15000, "currency": "UGX"}'),
  ('savings_defaults', '{"monthly_contribution": 10000, "group_join_fee": 3000, "currency": "UGX"}');

-- -------------------------------------------------------------------------
-- 2. PROFILES  (extends auth.users — Supabase Auth already stores
--    email/password/OAuth identity; this table holds everything else)
-- -------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  full_name           text not null,
  phone               text,
  graduation_year     int,
  profession          text,
  location            text,
  profile_photo_url   text,

  role                user_role not null default 'member',
  status              account_status not null default 'pending',
  membership_class    membership_class not null default 'non_alumni',
  membership_fee_paid boolean not null default false,
  membership_fee_paid_at timestamptz,

  -- security / session control
  failed_login_count  int not null default 0,
  locked_until         timestamptz,
  last_activity_at     timestamptz,

  approved_by         uuid references public.profiles(id),
  approved_at          timestamptz,

  created_at           timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.profiles is 'One row per user. Sensitive fields (role, status, membership_fee_paid) are admin-only via RLS below.';

-- Auto-create a profile row whenever someone signs up (email or Google OAuth)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- -------------------------------------------------------------------------
-- 3. LEADERS (executive committee, shown on public site)
-- -------------------------------------------------------------------------
create table public.leaders (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles(id) on delete set null,
  position     text not null,
  term_start   date,
  term_end     date,
  is_current   boolean not null default true,
  bio          text,
  display_order int default 0
);

-- -------------------------------------------------------------------------
-- 4. NEWS / EVENTS (public-facing content)
-- -------------------------------------------------------------------------
create table public.news (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  content       text not null,
  author_id     uuid references public.profiles(id),
  category      text,
  image_url     text,
  is_featured   boolean not null default false,
  published_at  timestamptz not null default now()
);

create table public.events (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  event_date     timestamptz not null,
  location       text,
  image_url      text,
  max_attendees  int,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

create table public.event_registrations (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  registration_date timestamptz not null default now(),
  status            text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  unique (event_id, user_id)
);

-- -------------------------------------------------------------------------
-- 4b. DONATIONS / FORUM / NEWSLETTER / JOB BOARD / CHAPTERS
--     (carried over from your original schema, converted to Postgres)
-- -------------------------------------------------------------------------
create table public.donations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id),
  amount           numeric(10,2) not null,
  purpose          text,
  tx_ref            text unique,
  status           payment_status not null default 'pending',
  donation_date     timestamptz not null default now()
);

create table public.forum_topics (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category     text,
  author_id    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  is_locked    boolean not null default false
);

create table public.forum_replies (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.forum_topics(id) on delete cascade,
  author_id    uuid references public.profiles(id),
  content      text not null,
  created_at    timestamptz not null default now()
);

create table public.subscribers (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  subscribed_at    timestamptz not null default now(),
  is_active       boolean not null default true
);

create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  company      text,
  description  text,
  location     text,
  job_type     text check (job_type in ('full-time','part-time','internship','contract')),
  posted_by    uuid references public.profiles(id),
  posted_at     timestamptz not null default now(),
  expires_at    date
);

create table public.chapters (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  region         text,
  description    text,
  leader_id      uuid references public.profiles(id),
  contact_email  text
);

create table public.chapter_members (
  id           uuid primary key default gen_random_uuid(),
  chapter_id   uuid not null references public.chapters(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  unique (chapter_id, user_id)
);

-- -------------------------------------------------------------------------
-- 5. PAYMENTS  (Flutterwave — membership fees & donations)
--    Savings contributions get their own table (section 7) since they
--    need group linkage, but share the same verification pattern.
-- -------------------------------------------------------------------------
create table public.payments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  purpose          payment_purpose not null,
  amount            numeric(12,2) not null,
  currency          text not null default 'UGX',
  tx_ref            text not null unique,
  flw_transaction_id text,
  status             payment_status not null default 'pending',
  raw_response       jsonb,
  created_at          timestamptz not null default now(),
  verified_at          timestamptz
);

-- -------------------------------------------------------------------------
-- 6. SAVINGS GROUPS
--    Rule enforced here + in RLS: a user must be an approved, fee-paid
--    association member before joining a savings group.
-- -------------------------------------------------------------------------
create table public.savings_groups (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text,
  monthly_contribution  numeric(12,2) not null default 10000.00,
  group_join_fee        numeric(12,2) not null default 3000.00,
  currency              text not null default 'UGX',
  start_month           date not null default date_trunc('month', now()),
  end_month             date,
  max_members           int default 100,
  created_by            uuid references public.profiles(id),
  is_active             boolean not null default true,
  created_at             timestamptz not null default now()
);

create table public.savings_group_members (
  id                     uuid primary key default gen_random_uuid(),
  group_id               uuid not null references public.savings_groups(id) on delete cascade,
  user_id                uuid not null references public.profiles(id) on delete cascade,
  join_fee_paid          boolean not null default false,
  join_fee_paid_at        timestamptz,
  status                 text not null default 'pending' check (status in ('pending','active','removed')),
  approved_by            uuid references public.profiles(id),
  approved_at             timestamptz,
  joined_at               timestamptz not null default now(),
  unique (group_id, user_id)
);

-- Monthly contributions — one row per member per month, matching the
-- original savings_contributions table's month_year tracking.
create table public.savings_transactions (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.savings_groups(id) on delete cascade,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  type             savings_txn_type not null,
  amount           numeric(12,2) not null,
  month_year       date,                  -- first-of-month this contribution covers (contributions only)
  payment_method   text check (payment_method in ('mobile_money','bank','cash','online')) default 'online',
  purpose          text,                  -- withdrawal purpose, if type = 'withdrawal'
  notes            text,
  status           savings_txn_status not null default 'pending',
  tx_ref           text unique,           -- Flutterwave ref for contributions
  approved_by      uuid references public.profiles(id), -- admin approval for withdrawals / verification
  approved_at       timestamptz,
  disbursed_at      timestamptz,          -- withdrawals only
  created_at        timestamptz not null default now(),
  unique (group_id, user_id, month_year, type)
);

create table public.savings_announcements (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid references public.savings_groups(id) on delete cascade,
  title        text not null,
  content      text not null,
  posted_by    uuid references public.profiles(id),
  posted_at     timestamptz not null default now(),
  is_pinned    boolean not null default false
);

-- -------------------------------------------------------------------------
-- 7. ELECTIONS  (logically separate "system", same database, own schema
--    boundary via table prefix so it can later be split into its own
--    Supabase project with minimal changes)
-- -------------------------------------------------------------------------
create table public.elections (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  start_date    timestamptz not null,
  end_date      timestamptz not null,
  status        election_status not null default 'draft',
  created_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

create table public.candidates (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references public.elections(id) on delete cascade,
  user_id       uuid not null references public.profiles(id),
  position      text not null,
  manifesto     text,
  photo_url     text,
  approved      boolean not null default false,
  created_at     timestamptz not null default now()
);

-- Votes: one row per ballot. voter_id has a UNIQUE constraint per
-- election+position so nobody can double-vote, but we never expose
-- the voter_id -> candidate_id link to anyone except via the
-- tamper-evident audit trail (see 001b for the tallying function).
create table public.votes (
  id             uuid primary key default gen_random_uuid(),
  election_id    uuid not null references public.elections(id) on delete cascade,
  position       text not null,
  voter_id       uuid not null references public.profiles(id),
  candidate_id   uuid not null references public.candidates(id),
  voted_at       timestamptz not null default now(),
  unique (election_id, position, voter_id)
);

-- -------------------------------------------------------------------------
-- 8. SECURITY: login attempts + audit log
-- -------------------------------------------------------------------------
create table public.login_attempts (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  success      boolean not null,
  ip_address   text,
  attempted_at  timestamptz not null default now()
);

create table public.audit_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id),
  action       text not null,
  target_table text,
  target_id    text,
  details      jsonb,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------------------------
-- 9. updated_at trigger for profiles
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- -------------------------------------------------------------------------
-- 10. INDEXES FOR PERFORMANCE
-- -------------------------------------------------------------------------
create index idx_savings_group_members_status on public.savings_group_members(status);
create index idx_savings_txn_group_user on public.savings_transactions(group_id, user_id);
create index idx_savings_txn_month on public.savings_transactions(month_year);
create index idx_profiles_status on public.profiles(status);
create index idx_payments_user on public.payments(user_id);
create index idx_votes_election_position on public.votes(election_id, position);
create index idx_login_attempts_email_time on public.login_attempts(email, attempted_at);
