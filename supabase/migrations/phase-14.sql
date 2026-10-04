-- Winter Arc — Phase 14 migration (PWA push reminders).
--
-- Run in the Supabase SQL editor. Idempotent: safe to run more than once.
--
-- BEFORE running section 4, add two secrets in Supabase Dashboard →
-- Project Settings → Vault (or Integrations → Vault) → "Add new secret":
--
--   name: winter_arc_site_url      value: https://winter-arc-challenge-blue.vercel.app
--   name: winter_arc_cron_secret   value: <the CRON_SECRET set in Vercel>
--
-- Neither value appears in this file; the cron job reads them from
-- vault.decrypted_secrets at run time, so rotating either is a Vault edit only.
--
-- Why not vercel.json crons: Vercel Hobby runs crons at most once a day, and
-- reminders need a 15-minute cadence. pg_cron fires, pg_net makes the call.

begin;

-- ---------------------------------------------------------------------------
-- 1. reminder_settings — per-user toggles and times
--
-- One jsonb document per user, validated by lib/reminders/settings.ts. A
-- missing row means "defaults derived from the profile".
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_settings (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.reminder_settings enable row level security;

drop policy if exists "reminder_settings: all own" on public.reminder_settings;
create policy "reminder_settings: all own" on public.reminder_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. reminder_log — dedupe
--
-- One row per reminder actually claimed for sending. The cron route inserts
-- with ON CONFLICT DO NOTHING and only sends when a row came back, so two
-- overlapping runs (or the repeated hour at a DST fall-back) can never send
-- the same reminder twice. kind is the dedupe key: the reminder kind, or
-- water_HH for the bi-hourly water slots.
--
-- Written only by the service role (cron). Users may read their own rows.
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_log (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null,
  local_date date not null,
  sent_at    timestamptz not null default now(),
  constraint reminder_log_unique unique (user_id, kind, local_date)
);

alter table public.reminder_log enable row level security;

drop policy if exists "reminder_log: read own" on public.reminder_log;
create policy "reminder_log: read own" on public.reminder_log
  for select using (auth.uid() = user_id);

create index if not exists reminder_log_sent_at on public.reminder_log (sent_at);

-- ---------------------------------------------------------------------------
-- 3. push_subscriptions — housekeeping columns
--
-- The table exists since Phase 1 (endpoint unique, owner-only RLS). created_at
-- and last_success_at help spot dead devices; user_agent labels them in
-- Settings. The per-subscription `reminders` column is superseded by
-- reminder_settings (preferences are per user, not per device) and left alone.
-- ---------------------------------------------------------------------------
alter table public.push_subscriptions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists last_success_at timestamptz,
  add column if not exists user_agent text;

-- ---------------------------------------------------------------------------
-- 4. pg_cron + pg_net: POST /api/cron/reminders every 15 minutes
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule with an existing job name updates that job in place.
select cron.schedule(
  'winter-arc-reminders',
  '*/15 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'winter_arc_site_url')
             || '/api/cron/reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'winter_arc_cron_secret'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);

-- Keep the dedupe log small: rows older than 14 days are never consulted.
select cron.schedule(
  'winter-arc-reminder-log-prune',
  '17 3 * * *',
  $job$ delete from public.reminder_log where sent_at < now() - interval '14 days'; $job$
);

commit;

-- ---------------------------------------------------------------------------
-- Checks (run after a few minutes):
--
--   select jobname, schedule, active from cron.job where jobname like 'winter-arc%';
--   select status, return_message, start_time from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname = 'winter-arc-reminders')
--    order by start_time desc limit 5;
--   select status_code, content::text, created from net._http_response
--    order by created desc limit 5;     -- expect 200 and {"ok":true,...}
-- ---------------------------------------------------------------------------
