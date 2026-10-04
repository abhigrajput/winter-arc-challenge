-- WINTER ARC — schema reference
--
-- The Supabase project referenced by .env.local is ALREADY PROVISIONED with the
-- tables below (RLS enforced on all of them, task_templates seeded with the 24
-- rows from CLAUDE.md §9, private storage bucket `progress` created).
--
-- This file documents that live schema so the repo is self-describing and the
-- app can be rebuilt on a fresh project. It is idempotent: every statement is
-- guarded, so running it against the existing project is a no-op for structure.
--
-- Column names, types and keys here were read back from the live database.
-- RLS POLICY BODIES AND CHECK CONSTRAINTS COULD NOT BE READ BACK over the REST
-- API, so the policies below are the intended definitions (owner-only on every
-- table) rather than a verified dump of what is live. The live project is
-- authoritative; treat any mismatch as a bug in this file.
--
-- STILL TO BE APPLIED: supabase/migrations/pre-phase-13.sql. It is the only
-- outstanding difference between this file and the live project, and it covers
-- the public_profiles view, the body_fat_pct trigger, the daily_logs DELETE
-- policy, the §4 log_date window trigger and profiles.onboarding_step. Each of
-- those is marked below. Nothing in the app depends on it having been run —
-- every one of them has an app-side fallback — but the guarantees are weaker
-- until it has.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id                uuid primary key references auth.users on delete cascade,
  username          text unique,
  display_name      text,
  avatar_url        text,

  sex               text check (sex in ('male', 'female')),
  age               int check (age between 13 and 100),
  height_cm         numeric,
  weight_kg         numeric,
  target_weight_kg  numeric,
  activity_level    numeric default 1.375,   -- TDEE multiplier: 1.2 / 1.375 / 1.55 / 1.725

  goal              text check (goal in
                      ('fat_loss', 'lean_bulk', 'recomp', 'six_pack', 'discipline', 'spiritual')),
  modules           text[] default '{}',

  training_mode     text check (training_mode in ('gym', 'home', 'hybrid')),
  equipment         text[] default '{}',
  max_dumbbell_kg   numeric,
  fitness_level     text check (fitness_level in ('beginner', 'intermediate', 'advanced')),
  days_per_week     int check (days_per_week between 3 and 6),
  session_minutes   int check (session_minutes in (30, 45, 60, 90)),

  diet_type         text check (diet_type in ('veg', 'egg', 'nonveg')),
  diet_notes        text,
  budget            text default 'normal' check (budget in ('hostel', 'normal')),

  calorie_target    int,
  protein_target_g  int,
  carbs_target_g    int,
  fat_target_g      int,
  water_target_ml   int,

  wake_time         time default '05:00',
  sleep_target_h    numeric default 8,
  timezone          text default 'Asia/Kolkata',
  challenge_start   date default current_date,

  is_public         boolean default true,
  onboarded         boolean default false,
  created_at        timestamptz default now()
);

-- Onboarding progress, stored in the database so it resumes on any device.
-- onboarding_step: index into STEPS (lib/onboarding/schema.ts) of the furthest
-- step submitted (pre-phase-13.sql). skipped_baseline: "Skip — measure later"
-- on the optional Baseline step (phase-13.sql).
alter table profiles
  add column if not exists onboarding_step int;
alter table profiles
  add column if not exists skipped_baseline boolean not null default false;

-- ---------------------------------------------------------------------------
-- tasks + daily logs
-- ---------------------------------------------------------------------------
create table if not exists task_templates (
  id              int primary key,
  slug            text unique not null,
  title           text not null,
  category        text not null,   -- discipline | body | face | mind | spirit | work
  module          text not null,   -- core | abs | face_skin | jawline | running | content_creator
  default_target  numeric not null,
  unit            text not null,   -- check | min | rounds | steps | km | L
  sort_order      int not null
);

-- IMPORTANT, verified against the live database: a trigger on signup inserts all
-- 24 task_templates into user_tasks immediately, before onboarding has asked for
-- a goal or any add-on modules. Those rows therefore carry raw template targets
-- with every module task switched off.
--
-- The exact trigger body could not be read back over the REST API. The app
-- reconciles afterwards (lib/tasks/preset.ts, called from finishOnboarding and
-- from /tasks), which is what makes the §9 goal presets actually take effect.
-- If that trigger is ever removed, lib/tasks/ensure.ts seeds the rows instead.
create table if not exists user_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  template_id int references task_templates (id),
  title       text not null,
  category    text not null,
  target      numeric not null,
  unit        text not null,
  is_custom   boolean default false,
  active      boolean default true,
  sort_order  int,
  created_at  timestamptz default now()
);

-- VERIFIED GAP IN THE LIVE DATABASE: there is no DELETE policy on daily_logs.
-- A delete issued as the owning user returns HTTP 204 but removes nothing, so
-- switching a task off leaves an orphan row for the current day. The app works
-- around it by excluding inactive tasks from the current day's totals
-- (lib/calc/streak.ts). user_tasks, by contrast, does allow the owner to
-- delete. The policy is in supabase/migrations/pre-phase-13.sql (5a) and is
-- restated further down with the other policies.
create table if not exists daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  user_task_id  uuid not null references user_tasks (id) on delete cascade,
  log_date      date not null,
  completed     boolean default false,
  value         numeric,
  completed_at  timestamptz,
  -- Verified against the live database: the unique key includes user_id.
  unique (user_id, user_task_id, log_date)
);

-- §4: daily logs are accepted only for yesterday, today and tomorrow.
--
-- NOT PRESENT IN THE LIVE DATABASE YET. Verified by inserting a log 30 days in
-- the past through PostgREST, which succeeded. Until this trigger is applied,
-- the rule is enforced only in app/(app)/today/actions.ts, which means anything
-- talking to the database directly can still backfill. Shipped in
-- supabase/migrations/pre-phase-13.sql (5b).
--
-- It has to be a trigger rather than a CHECK constraint, because current_date
-- is not IMMUTABLE and CHECK constraints may not call it.
--
-- The window is evaluated in the owning user's timezone, so a user in
-- Asia/Kolkata gets their own midnight, not the server's.
create or replace function enforce_log_date_window()
returns trigger language plpgsql as $window$
declare
  user_today date;
begin
  select (now() at time zone coalesce(p.timezone, 'Asia/Kolkata'))::date
    into user_today
    from profiles p
   where p.id = new.user_id;

  if user_today is null then
    user_today := (now() at time zone 'Asia/Kolkata')::date;
  end if;

  if new.log_date < user_today - 1 or new.log_date > user_today + 1 then
    raise exception 'log_date % is outside the writable window (% to %)',
      new.log_date, user_today - 1, user_today + 1
      using errcode = 'check_violation';
  end if;

  return new;
end $window$;

drop trigger if exists daily_logs_date_window on daily_logs;
create trigger daily_logs_date_window before insert or update of log_date on daily_logs
  for each row execute function enforce_log_date_window();

-- ---------------------------------------------------------------------------
-- training
-- ---------------------------------------------------------------------------
create table if not exists exercises (
  id             int primary key,
  slug           text unique not null,
  name           text not null,
  muscle_group   text not null,
  equipment      text not null,
  level          text not null,
  is_bodyweight  boolean default false,
  cues           text[] default '{}',
  mistakes       text[] default '{}',
  progression_of int references exercises (id),
  video_url      text
);

-- Corrected against the live database: this table uses session_date /
-- started_at / finished_at / plan_day, not the log_date / split / completed_at
-- shape the brief implies. Duration is derived from the timestamps and volume
-- is computed from the sets rather than stored.
create table if not exists workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  session_date date not null,
  plan_week    int,
  plan_day     text,              -- split day name: Push, Pull, Upper, ...
  started_at   timestamptz,
  finished_at  timestamptz,       -- null while the session is in progress
  session_rpe  int,
  soreness     int,
  notes        text
);

-- Corrected against the live database: carries its own user_id (so RLS does
-- not need to reach through the session), numbers sets with set_no, and has a
-- duration_sec column for timed holds such as dead hangs and planks.
create table if not exists workout_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references workout_sessions (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  exercise_id  int not null references exercises (id),
  set_no       int not null,
  reps         int,
  weight_kg    numeric,
  duration_sec int,
  rpe          numeric,
  is_pr        boolean default false,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- nutrition, body, face, sleep
-- ---------------------------------------------------------------------------
create table if not exists food_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  log_date    date not null,
  meal        text,
  description text not null,
  calories    int not null,
  protein_g   numeric,
  carbs_g     numeric,
  fat_g       numeric,
  -- Verified against the live CHECK constraint: exactly these, or null.
  source      text check (source in ('manual', 'plan', 'ai_estimate')),
  created_at  timestamptz default now()
);

create table if not exists water_logs (
  user_id  uuid not null references profiles (id) on delete cascade,
  log_date date not null,
  ml       int default 0,
  primary key (user_id, log_date)
);

create table if not exists body_measurements (
  user_id      uuid not null references profiles (id) on delete cascade,
  log_date     date not null,
  weight_kg    numeric,
  waist_cm     numeric,
  chest_cm     numeric,
  arm_cm       numeric,
  thigh_cm     numeric,
  neck_cm      numeric,
  hip_cm       numeric,
  body_fat_pct numeric,
  primary key (user_id, log_date)
);

-- §6 US Navy estimate, computed in the database so the number does not depend
-- on which client wrote the row. Mirrors lib/calc/bodyfat.ts navyBodyFat()
-- exactly — same constants, same 1-decimal rounding, same refusals (waist not
-- bigger than neck, hip missing for a woman). sex and height_cm are read from
-- profiles rather than taken from the request.
--
-- NOT PRESENT IN THE LIVE DATABASE YET: supabase/migrations/pre-phase-13.sql
-- (3). Until applied, body_fat_pct is whatever the app computed and sent.
-- `npm run verify:bodyfat` pushes lib/calc/bodyfat-fixtures.ts through the live
-- trigger and fails on any disagreement.
create or replace function compute_navy_body_fat()
returns trigger language plpgsql as $bf$
declare
  p_sex    text;
  p_height numeric;
  girth    numeric;
  estimate numeric;
begin
  select pr.sex, pr.height_cm into p_sex, p_height
    from profiles pr
   where pr.id = new.user_id;

  if p_sex is null or p_height is null or p_height <= 0
     or new.waist_cm is null or new.waist_cm <= 0
     or new.neck_cm is null or new.neck_cm <= 0 then
    return new;
  end if;

  if p_sex = 'male' then
    girth := new.waist_cm - new.neck_cm;
    if girth <= 0 then
      return new;
    end if;
    estimate := 495 / (1.0324 - 0.19077 * log(10, girth) + 0.15456 * log(10, p_height)) - 450;
  else
    if new.hip_cm is null or new.hip_cm <= 0 then
      return new;
    end if;
    girth := new.waist_cm + new.hip_cm - new.neck_cm;
    if girth <= 0 then
      return new;
    end if;
    estimate := 495 / (1.29579 - 0.35004 * log(10, girth) + 0.221 * log(10, p_height)) - 450;
  end if;

  new.body_fat_pct := round(estimate, 1);
  return new;
end $bf$;

drop trigger if exists body_measurements_body_fat on body_measurements;
create trigger body_measurements_body_fat
  before insert or update of waist_cm, neck_cm, hip_cm on body_measurements
  for each row execute function compute_navy_body_fat();

-- Files live in the private `progress` bucket at {user_id}/{date}-{angle}.jpg
create table if not exists progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  log_date     date not null,
  angle        text not null,   -- front | side | back | face
  storage_path text not null,
  created_at   timestamptz default now()
);

create table if not exists skin_logs (
  user_id   uuid not null references profiles (id) on delete cascade,
  log_date  date not null,
  am_done   boolean default false,
  pm_done   boolean default false,
  breakouts int check (breakouts between 0 and 5),
  dairy     boolean,
  notes     text,
  primary key (user_id, log_date)
);

create table if not exists sleep_logs (
  user_id   uuid not null references profiles (id) on delete cascade,
  log_date  date not null,
  bed_time  timestamptz,
  wake_time timestamptz,
  hours     numeric,
  quality   int check (quality between 1 and 5),
  primary key (user_id, log_date)
);

-- ---------------------------------------------------------------------------
-- mind / spirit / work
-- ---------------------------------------------------------------------------
create table if not exists gita_progress (
  user_id      uuid not null references profiles (id) on delete cascade,
  chapter      int not null check (chapter between 1 and 18),
  verse        int,
  completed_at timestamptz,
  primary key (user_id, chapter)
);

create table if not exists content_posts (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references profiles (id) on delete cascade,
  log_date date not null,
  platform text,
  url      text,
  title    text
);

-- VERIFIED IN THE LIVE DATABASE: ordinary users cannot INSERT here — the attempt
-- returns 42501. That is the right call rather than a gap: badges appear on the
-- public profile (§8.12), so a user must not be able to award themselves one.
-- The app grants them with the service-role client in lib/stats/load.ts, always
-- scoped to the authenticated user id.
create table if not exists achievements (
  user_id   uuid not null references profiles (id) on delete cascade,
  code      text not null,
  earned_at timestamptz default now(),
  primary key (user_id, code)
);

-- ---------------------------------------------------------------------------
-- AI + push
-- ---------------------------------------------------------------------------
create table if not exists ai_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  plan_type  text not null,   -- workout | diet | skincare
  week       int not null,
  content    jsonb not null,
  is_active  boolean default true,
  created_at timestamptz default now()
);

create table if not exists ai_usage (
  id         bigserial primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  route      text not null,
  created_at timestamptz default now()
);

create table if not exists push_subscriptions (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references profiles (id) on delete cascade,
  endpoint  text not null unique,
  p256dh    text not null,
  auth      text not null,
  reminders jsonb default '{}'::jsonb   -- superseded by reminder_settings
);
-- Phase 14 (supabase/migrations/phase-14.sql).
alter table push_subscriptions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_success_at timestamptz,
  add column if not exists user_agent text;

-- Per-user reminder toggles + times, validated by lib/reminders/settings.ts.
create table if not exists reminder_settings (
  user_id    uuid primary key references profiles (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Reminder dedupe: the cron claims (user, key, local date) before sending.
-- Service role writes; users read their own rows. The pg_cron + pg_net
-- schedule is in phase-14.sql (secrets live in Supabase Vault, not here).
create table if not exists reminder_log (
  user_id    uuid not null references profiles (id) on delete cascade,
  kind       text not null,
  local_date date not null,
  sent_at    timestamptz not null default now(),
  constraint reminder_log_unique unique (user_id, kind, local_date)
);

-- ---------------------------------------------------------------------------
-- RLS — enabled on every table.
-- ---------------------------------------------------------------------------
do $rls$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_tasks', 'daily_logs', 'workout_sessions', 'workout_sets',
    'food_entries', 'water_logs', 'body_measurements', 'progress_photos',
    'skin_logs', 'sleep_logs', 'gita_progress', 'content_posts', 'achievements',
    'ai_plans', 'ai_usage', 'push_subscriptions', 'task_templates', 'exercises'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $rls$;

-- Seed/reference data: readable by any signed-in user, written only by migrations.
drop policy if exists "task_templates: read" on task_templates;
create policy "task_templates: read" on task_templates
  for select to authenticated using (true);

drop policy if exists "exercises: read" on exercises;
create policy "exercises: read" on exercises
  for select to authenticated using (true);

-- profiles: own row only.
--
-- CORRECTION TO AN EARLIER VERSION OF THIS FILE: it declared a second policy,
-- "profiles: read public", granting SELECT on any row where is_public and
-- onboarded. That policy was never applied to the live project, and it should
-- not be: profiles holds weight_kg, target_weight_kg, body targets and
-- calorie_target, so a readable row leaks body data, which CLAUDE.md §8.12
-- forbids. Verified live — a second authenticated user selecting all profiles
-- gets back only their own row, and an anon request gets an empty array even
-- when a public, onboarded profile exists.
--
-- /u/[username] reads public_profiles instead (below).
drop policy if exists "profiles: all own" on profiles;
create policy "profiles: all own" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles: read public" on profiles;

-- The public face of a profile: five columns, discipline data only. Not
-- security_invoker, so it runs as its owner and can see past the own-row
-- policy above; the WHERE clause and the column list are therefore the entire
-- public exposure. Adding a column here makes that column public.
--
-- NOT PRESENT IN THE LIVE DATABASE YET: supabase/migrations/pre-phase-13.sql
-- (2). Phase 13 depends on it.
create or replace view public_profiles
with (security_invoker = false) as
  select p.id, p.username, p.display_name, p.avatar_url, p.challenge_start
    from profiles p
   where p.is_public and p.onboarded;

grant select on public_profiles to anon, authenticated;

-- See supabase/migrations/pre-phase-13.sql (5a). "for all" on daily_logs does
-- not currently cover DELETE in the live project.
drop policy if exists "daily_logs: delete own" on daily_logs;
create policy "daily_logs: delete own" on daily_logs
  for delete using (auth.uid() = user_id);

-- Every user-owned table: full access to own rows only.
do $own$
declare
  t text;
begin
  foreach t in array array[
    'user_tasks', 'daily_logs', 'workout_sessions', 'food_entries', 'water_logs',
    'body_measurements', 'progress_photos', 'skin_logs', 'sleep_logs',
    'gita_progress', 'content_posts', 'achievements', 'ai_plans', 'ai_usage',
    'push_subscriptions'
  ] loop
    execute format('drop policy if exists %L on %I', t || ': all own', t);
    execute format(
      'create policy %L on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t || ': all own', t
    );
  end loop;
end $own$;

-- workout_sets carries user_id directly, so it uses the same owner-only rule
-- as every other user table.
drop policy if exists "workout_sets: all own" on workout_sets;
create policy "workout_sets: all own" on workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: private bucket, owner-only. Signed URLs (60 s) are the only reads.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress', 'progress', false)
on conflict (id) do nothing;

drop policy if exists "progress: own files" on storage.objects;
create policy "progress: own files" on storage.objects
  for all using (
    bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'progress' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Creates a stub profile on signup. Onboarding fills the rest.
-- ---------------------------------------------------------------------------
-- Verified against the live project: a signup yields username 'user_<first 8 of
-- uuid>' and display_name set to the email local part. The remaining defaults
-- come from the column definitions above (activity_level 1.375, budget normal,
-- wake_time 05:00, sleep_target_h 8, timezone Asia/Kolkata, challenge_start
-- today, is_public true, onboarded false). Onboarding overwrites all of them
-- and lets the user claim a real username.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into profiles (id, username, display_name)
  values (
    new.id,
    'user_' || left(new.id::text, 8),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;

  return new;
end $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Stored procedures that already exist in the live project.
--
-- Read back from the PostgREST spec; the bodies could not be. They were
-- provisioned with the project, so they are listed here as an inventory rather
-- than as definitions this file can recreate. Signatures:
--
--   ensure_day_logs(p_date date)
--     Seeds the current day's daily_logs rows. Named in CLAUDE.md §13 Phase 3.
--     lib/tasks/ensure.ts does the same work in TypeScript.
--
--   apply_modules(p_modules text[])
--     Activates/deactivates user_tasks for the selected §5 add-on modules.
--     lib/tasks/preset.ts is the TypeScript equivalent and is what the app
--     actually calls, because it also applies the §9 goal presets.
--
--   get_leaderboard(p_days int, p_limit int)
--     Returns user_id, username, display_name, avatar_url, points,
--     current_streak — discipline only, which is what §4 requires. Verified by
--     calling it: p_days 7 gives the weekly board, a large p_days the all-time
--     one. This is the right primitive for Phase 13.
--
--   ai_remaining(p_route text, p_limit int, p_window interval)
--     Remaining AI calls for the current user against the §8.9 quotas.
--
--   get_streak(p_user uuid)
--     Current streak for one user. Since supabase/migrations/phase-13.sql this
--     is a SECURITY DEFINER wrapper: 0 unless the caller is that user or the
--     user is public and onboarded. The provisioned body lives on, untouched,
--     as private.get_streak_unchecked (not exposed through PostgREST).
--
--   get_public_profile(p_username text)            -- phase-13.sql
--     /u/[username] data: per-day completion counts and badge codes for a
--     public, onboarded user; NULL otherwise. Never body data.
--
-- There is NO award_achievement RPC, and supabase/migrations/pre-phase-13.sql
-- (1) drops it if one is ever added. Badges are written only by the service
-- role (lib/stats/load.ts), because they appear on the public profile and so
-- must not be self-awardable.
-- ---------------------------------------------------------------------------
