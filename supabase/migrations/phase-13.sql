-- Winter Arc — Phase 13 migration (leaderboard + public profiles).
--
-- Paste the whole file into the Supabase SQL editor and run it once. It is
-- idempotent: every statement is guarded, so running it twice is harmless.
--
--   1. profiles.skipped_baseline — onboarding progress lives in the database
--      (with the existing profiles.onboarding_step), not a cookie.
--   2. get_streak fix — returns 0 unless the caller is that user, or the user
--      is public AND onboarded. Before this, anyone (including anon) could read
--      the streak of a private or unfinished account.
--   3. get_public_profile(username) — the discipline data /u/[username] shows:
--      per-day task completion and earned badge codes. Nothing else.

begin;

-- ---------------------------------------------------------------------------
-- 1. profiles.skipped_baseline
--
-- onboarding_step (added in pre-phase-13.sql) holds the index of the furthest
-- step submitted. skipped_baseline records "Skip — measure later", so the
-- optional Baseline step counts as done on any device.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists skipped_baseline boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. get_streak: visibility check in front of the existing calculation
--
-- The original body was provisioned with the project and is not in the repo,
-- so it is moved, untouched, to a schema PostgREST does not expose and wrapped.
-- The wrapper is SECURITY DEFINER so it can check profiles past the own-row
-- policy; the WHERE clause is the entire exposure.
--
-- get_leaderboard already lists only public + onboarded users (verified live),
-- so whichever get_streak it resolves to returns the same numbers there.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $move$
begin
  if not exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'get_streak_unchecked'
  ) then
    alter function public.get_streak(uuid) set schema private;
    alter function private.get_streak(uuid) rename to get_streak_unchecked;
  end if;
end $move$;

revoke all on function private.get_streak_unchecked(uuid) from public, anon, authenticated;

create or replace function public.get_streak(p_user uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $fn$
begin
  if p_user is null then
    return 0;
  end if;

  if p_user is distinct from auth.uid() and not exists (
    select 1
      from public.profiles p
     where p.id = p_user and p.is_public and p.onboarded
  ) then
    return 0;
  end if;

  return coalesce(private.get_streak_unchecked(p_user), 0)::integer;
end $fn$;

comment on function public.get_streak(uuid) is
  'Current streak. 0 unless the caller is the user, or the user is public and onboarded. Wraps private.get_streak_unchecked.';

revoke all on function public.get_streak(uuid) from public;
grant execute on function public.get_streak(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_public_profile(username)
--
-- Returns NULL unless the profile is public and onboarded (same rule as the
-- public_profiles view). Exposes, per log_date, how many tasks were logged and
-- how many were done — mirroring lib/calc/streak.ts summariseDays(): past days
-- count every log, today and later count only tasks still active — plus earned
-- badge codes. No weight, measurements, nutrition, photos or task titles.
-- Adding a key here makes it public.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_id    uuid;
  v_today date;
begin
  select p.id, (now() at time zone coalesce(p.timezone, 'Asia/Kolkata'))::date
    into v_id, v_today
    from public.profiles p
   where p.username = lower(p_username) and p.is_public and p.onboarded;

  if v_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'today', v_today,
    'days', coalesce((
      select jsonb_agg(
               jsonb_build_object('date', d.log_date, 'completed', d.completed, 'active', d.active)
               order by d.log_date)
        from (
          select dl.log_date,
                 count(*) filter (where dl.completed) as completed,
                 count(*) as active
            from public.daily_logs dl
            left join public.user_tasks ut on ut.id = dl.user_task_id
           where dl.user_id = v_id
             and (dl.log_date < v_today or ut.active is true)
           group by dl.log_date
        ) d
    ), '[]'::jsonb),
    'achievements', coalesce((
      select jsonb_agg(a.code order by a.earned_at)
        from public.achievements a
       where a.user_id = v_id
    ), '[]'::jsonb)
  );
end $fn$;

comment on function public.get_public_profile(text) is
  'Public discipline data for /u/[username]: daily completion counts and badge codes. NULL unless public and onboarded. Never add body data (CLAUDE.md 8.12).';

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;

commit;
