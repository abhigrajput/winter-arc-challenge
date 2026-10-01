-- Winter Arc — everything that must be applied before Phase 13.
--
-- Paste the whole file into the Supabase SQL editor and run it once. It is
-- idempotent: every statement is guarded, so running it twice is harmless.
--
-- Five items, in the order they were asked for:
--   1. drop the award_achievement RPC
--   2. profiles SELECT -> own row only, plus a public_profiles view
--   3. body_measurements trigger computing body_fat_pct (US Navy)
--   4. (app-side only, no SQL: the heatmap day-91 cell)
--   5. the three previously pending items: daily_logs DELETE policy,
--      the §4 log_date window trigger, profiles.onboarding_step

begin;

-- ---------------------------------------------------------------------------
-- 1. award_achievement RPC
--
-- Already absent from this database — the live RPC list is ensure_day_logs,
-- apply_modules, get_leaderboard, ai_remaining, get_streak. Dropped anyway so
-- the statement is a standing guarantee rather than a one-time observation.
-- Badges are written only by the service role (lib/stats/load.ts), because
-- they appear on the public profile and so must not be self-awardable.
-- ---------------------------------------------------------------------------
drop function if exists public.award_achievement(uuid, text);
drop function if exists public.award_achievement(text);
drop function if exists public.award_achievement();

-- ---------------------------------------------------------------------------
-- 2. profiles: own row only + public_profiles view
--
-- The "read public" policy in the Phase 1 schema was never applied here, so
-- SELECT is already own-row-only. The drop makes that permanent: with it in
-- place, nothing can read another user's profiles row, which is what keeps
-- weight_kg, target_weight_kg, calorie_target and the rest private.
--
-- /u/[username] instead reads the view below, which exposes five columns and
-- nothing else. The view is deliberately NOT security_invoker: it runs as its
-- owner so it can see past the own-row policy, and the WHERE clause plus the
-- column list are the entire exposure. Adding a column here makes it public.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles: read public" on public.profiles;

create or replace view public.public_profiles
with (security_invoker = false) as
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.challenge_start
  from public.profiles p
  where p.is_public and p.onboarded;

comment on view public.public_profiles is
  'Public-safe projection of profiles for /u/[username]. Discipline data only: no body measurements, nutrition, targets or photos. Do not add columns without checking them against CLAUDE.md 8.12.';

grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. body_measurements.body_fat_pct — US Navy, computed in the database
--
-- Mirrors lib/calc/bodyfat.ts navyBodyFat() exactly, including the 1-decimal
-- rounding and the null cases (waist not bigger than neck; hip missing for
-- women). sex and height_cm come from profiles, so the client cannot pass a
-- height that flatters the number.
--
-- It overwrites whatever the client sent whenever it can compute a value, and
-- leaves the submitted value alone when it cannot. Treat the result as an
-- estimate good to about 4 points either way (BODY_FAT_ERROR_MARGIN).
-- ---------------------------------------------------------------------------
create or replace function public.compute_navy_body_fat()
returns trigger language plpgsql as $bf$
declare
  p_sex    text;
  p_height numeric;
  girth    numeric;
  estimate numeric;
begin
  select pr.sex, pr.height_cm into p_sex, p_height
    from public.profiles pr
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

drop trigger if exists body_measurements_body_fat on public.body_measurements;
create trigger body_measurements_body_fat
  before insert or update of waist_cm, neck_cm, hip_cm on public.body_measurements
  for each row execute function public.compute_navy_body_fat();

-- ---------------------------------------------------------------------------
-- 5a. daily_logs DELETE policy
--
-- Without it, a delete issued as the owning user returns 204 and removes
-- nothing, so switching a task off strands that day's row. lib/calc/streak.ts
-- works around it by excluding inactive tasks; with the policy the rows can
-- actually go.
-- ---------------------------------------------------------------------------
drop policy if exists "daily_logs: delete own" on public.daily_logs;
create policy "daily_logs: delete own" on public.daily_logs
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5b. §4 log_date window: yesterday, today, tomorrow only
--
-- Enforced in app/(app)/today/actions.ts today, which leaves anything talking
-- to PostgREST directly free to backfill. A trigger rather than a CHECK,
-- because current_date is not IMMUTABLE. The window is evaluated in the
-- owning user's timezone, so Asia/Kolkata gets its own midnight.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_log_date_window()
returns trigger language plpgsql as $window$
declare
  user_today date;
begin
  select (now() at time zone coalesce(p.timezone, 'Asia/Kolkata'))::date
    into user_today
    from public.profiles p
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

drop trigger if exists daily_logs_date_window on public.daily_logs;
create trigger daily_logs_date_window
  before insert or update of log_date on public.daily_logs
  for each row execute function public.enforce_log_date_window();

-- ---------------------------------------------------------------------------
-- 5c. profiles.onboarding_step
--
-- Onboarding currently derives how far the user got from which fields are
-- filled in (lib/onboarding/progress.ts). That works but guesses; this column
-- lets the step be stored outright. Nullable, so existing rows stay valid and
-- the derived path remains the fallback.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_step int;

commit;
