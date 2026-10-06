-- Winter Arc — instant signup abuse guard.
--
-- Run in the Supabase SQL editor. Idempotent.
--
-- Email confirmation is off, so an account is live the moment it is created.
-- The /login signup action allows at most 5 signups per IP per hour, counted
-- here. Serverless instances share nothing in memory, so the count lives in
-- the database. The IP is never stored: only an HMAC-SHA256 of it, keyed with
-- a server-only secret (lib/auth/rate-limit.ts).

begin;

create table if not exists public.signup_attempts (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index if not exists signup_attempts_ip_time on public.signup_attempts (ip_hash, created_at desc);

-- RLS on with no policies: only the service role (server) can read or write.
alter table public.signup_attempts enable row level security;

-- Rows older than a day are never consulted.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'winter-arc-signup-attempts-prune',
  '41 4 * * *',
  $job$ delete from public.signup_attempts where created_at < now() - interval '1 day'; $job$
);

commit;
