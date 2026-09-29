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

create table if not exists daily_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles (id) on delete cascade,
  user_task_id  uuid not null references user_tasks (id) on delete cascade,
  log_date      date not null,
  completed     boolean default false,
  value         numeric,
  completed_at  timestamptz,
  unique (user_task_id, log_date)
);

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

create table if not exists workout_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  log_date     date not null,
  split        text,
  duration_min int,
  total_volume numeric,
  notes        text,
  completed_at timestamptz
);

create table if not exists workout_sets (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references workout_sessions (id) on delete cascade,
  exercise_id int not null references exercises (id),
  set_index   int not null,
  reps        int,
  weight_kg   numeric,
  rpe         numeric,
  is_pr       boolean default false
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
  source      text,   -- plan | quick_add | ai_estimate
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
  reminders jsonb default '{}'::jsonb
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

-- profiles: own row, plus public discipline data for /u/[username].
-- Body data, nutrition and photos live in other tables and are never public.
drop policy if exists "profiles: all own" on profiles;
create policy "profiles: all own" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles: read public" on profiles;
create policy "profiles: read public" on profiles
  for select using (is_public and onboarded);

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

-- workout_sets has no user_id — ownership comes through the parent session.
drop policy if exists "workout_sets: all own" on workout_sets;
create policy "workout_sets: all own" on workout_sets
  for all using (
    exists (
      select 1 from workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = auth.uid()
    )
  );

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
