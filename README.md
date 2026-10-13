# Winter Arc

90-day self-transformation OS. Daily checklist, workout logger, nutrition + macros, body
measurements, progress photos, AI coach, stats, achievements, global leaderboard.

Cold, short, zero fluff. Dark theme only. Mobile-first. Installable PWA.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind + shadcn/ui · Supabase (Auth, Postgres,
RLS, private Storage, pg_cron + pg_net) · DeepSeek API (server-only) · zod · Vitest · Playwright ·
Web Push · Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

### Environment variables

| Variable | Where | What |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Anon key. Every user read/write goes through it, under RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Bypasses RLS. Cron, badge grants, signup counter, account deletion, e2e + audit scripts |
| `DEEPSEEK_API_KEY` | server only | AI coach. Unset = every AI route serves the template fallback |
| `DEEPSEEK_MODEL` | server only | Reasoning model for `/api/ai/plan` and `/api/ai/checkin` (`deepseek-v4-pro`) |
| `DEEPSEEK_MODEL_FAST` | server only | Fast model for `/api/ai/meal-estimate` (`deepseek-v4-flash`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client + server | Web Push public key |
| `VAPID_PRIVATE_KEY` | server only | Web Push private key (`npx web-push generate-vapid-keys`) |
| `VAPID_SUBJECT` | server only | Optional. `mailto:` or https contact for push services; defaults to the site URL |
| `CRON_SECRET` | server only | Bearer secret for `/api/cron/reminders`; same value as Vault `winter_arc_cron_secret` |
| `SIGNUP_IP_SALT` | server only | Optional. HMAC key for hashed signup IPs; falls back to the service-role key |
| `NEXT_PUBLIC_SITE_URL` | server | Optional. Canonical origin for Open Graph URLs; falls back to Vercel's production domain |

Nothing server-only is prefixed `NEXT_PUBLIC_`; `server-only` imports keep the rest out of
client bundles.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (all `lib/calc/*`, guardrails, CSP, account helpers, ...) |
| `npm run test:e2e` | Playwright against `next start` on :3217 (run `npm run build` first) |
| `E2E_BASE_URL=https://... npm run test:e2e` | Same suite against a deployed URL |
| `npx tsx scripts/rls-audit.mts` | RLS + storage audit against the live project (see Security) |
| `npm run seed:exercises` | Upsert the 85-exercise library |

Build, lint and unit tests must pass before a commit. e2e and the audit create throwaway
`e2e-*@example.com` users and delete them (and their photos) when they finish, pass or fail.

## Database

`supabase/schema.sql` documents the full live schema (23 tables + the `public_profiles` view,
RLS enforced on every table, `task_templates` seeded with the 24 default tasks, private `progress`
storage bucket). `lib/supabase/types.ts` mirrors it; when a table changes, update both.

### Migrations order

Run each file once in the Supabase SQL editor, in this order. Every file is idempotent.

1. `supabase/schema.sql` — base tables, RLS policies, seed templates, storage bucket + policy.
2. `supabase/migrations/pre-phase-13.sql` — own-row-only profiles + `public_profiles` view,
   body-fat trigger, `daily_logs` delete policy, §4 log-date window trigger, `onboarding_step`.
3. `supabase/migrations/phase-13.sql` — `skipped_baseline`, private-aware `get_streak`,
   `get_public_profile`.
4. `supabase/migrations/phase-14.sql` — `reminder_settings`, `reminder_log`, push tables, and
   the pg_cron job that calls the reminder route (**add the Vault secrets first**, below).
5. `supabase/migrations/phase-15.sql` — `signup_attempts` (30 signups/IP/hour) + its daily prune job.

Then `npm run seed:exercises`.

### Cron + Vault

Reminders need a 15-minute cadence; Vercel Hobby crons run at most daily, so the scheduler is
Supabase **pg_cron**, calling the app with **pg_net**. Before step 4 above, add two secrets in
Supabase → Project Settings → Vault:

| Vault secret | Value |
| --- | --- |
| `winter_arc_site_url` | The production origin, e.g. `https://winter-arc-challenge-blue.vercel.app` |
| `winter_arc_cron_secret` | Exactly the `CRON_SECRET` set in Vercel |

The job reads them from `vault.decrypted_secrets` at run time, so rotating either is a Vault
edit only. `/api/cron/reminders` rejects any call without `Authorization: Bearer <CRON_SECRET>`.
`vercel.json` deliberately declares no crons.

## Auth

- `proxy.ts` (Next 16's renamed middleware) refreshes the Supabase session on every request and
  redirects unauthenticated users to `/login?next=…`.
- `lib/supabase/{client,server,middleware}.ts` hold the browser, server and edge clients.
  `createServiceClient()` bypasses RLS and is for cron jobs only.
- `/auth/callback` exchanges the OAuth / email-confirmation code for a session.
- `lib/safe-redirect.ts` whitelists `?next=` targets so the flow cannot be used as an open redirect.

Google sign-in additionally needs the provider enabled in Supabase Auth, with the Supabase callback
URL registered in Google Cloud OAuth.

## Calc engine

All arithmetic lives in `lib/calc/*` as pure, unit-tested functions — components never do maths.

| Module | What it owns |
| --- | --- |
| `tdee.ts` | Mifflin-St Jeor BMR, activity multipliers, TDEE |
| `guardrails.ts` | §10 safety rules: calorie floors, 1%/week loss cap, under-18 cap, BMI 18.5 block |
| `macros.ts` | Calorie target per goal, protein/fat/carb split, water target |
| `bodyfat.ts` | US Navy estimate and its error band |
| `projection.ts` | 90-day weight range, weeks-to-body-fat for the Abs ETA card |
| `plan.ts` | Composes the above into the onboarding result |

Every calorie number is routed through `clampCalories`, so a goal preset or an AI suggestion
cannot produce an unsafe target.

## Onboarding

Ten steps (`lib/onboarding/schema.ts`), each validated with zod and saved on submit, so a
half-finished setup survives a refresh. Progress is derived from two sources and the furthest
wins: the filled columns on `profiles`, plus a cookie recording the furthest step submitted.
The cookie exists because `wake_time`, `sleep_target_h`, `budget` and `modules` all arrive
pre-populated by the signup trigger, making "still the default" indistinguishable from "the user
chose exactly that". Adding an `onboarding_step` column to the live schema would remove the need
for it.

Deep-linking past an unfinished step redirects back; an onboarded user is bounced out of setup
entirely.

## Checklist, streaks and points

`/today` seeds `user_tasks` from `task_templates` on first visit (tasks whose module the
user did not pick are inserted inactive, per §9) and creates that day's `daily_logs` rows
lazily. Both are idempotent.

Streak and points are **derived, never stored** — the live schema has no columns for them, and
deriving keeps them from drifting out of sync with the logs.

- A day counts toward the streak at >= 80% of that day's active tasks. The denominator is the
  number of log rows that exist for that date, so deactivating a task later never rewrites an
  earned day.
- Today falling short does not break the run — there is still time left in the day.
- Points: 10/task, +20 full day, +15 workout logged, +25 check-in.

### The date window

§4 allows writes for yesterday, today and tomorrow only, measured in the user's own timezone.
**The live database does not enforce this** — a log 30 days in the past inserts fine through
PostgREST. Today the rule lives only in `app/(app)/today/actions.ts`. `supabase/schema.sql`
carries the trigger that would close the gap; it needs to be applied by hand.

## Tasks, goals and modules

`lib/goals.ts` holds the §9 goal presets: target overrides, modules a goal forces on, reworded
titles and tasks a goal treats as optional. `/tasks` lets the user switch any task on or off,
edit any target, toggle modules and add or delete custom tasks.

### Two live-schema behaviours the app has to work around

**The database seeds `user_tasks` by trigger at signup**, before onboarding has asked for a goal
or any modules — so those rows carry raw template targets with every add-on module off. The app
reconciles afterwards (`lib/tasks/preset.ts`), called at the end of onboarding and from the
"Reset to goal defaults" button. Without that step the goal presets would never take effect.

**There is no DELETE policy on `daily_logs`.** A delete issued as the owning user returns
HTTP 204 and removes nothing. Switching a task off therefore leaves an orphan log row for the
current day, which would otherwise make the day permanently unfinishable. `summariseDays`
excludes inactive tasks from the current day's totals instead; past days keep every row, so a
streak already earned is never rewritten. `user_tasks`, by contrast, does allow owner deletes,
so custom tasks delete properly.

Both are recorded in `supabase/schema.sql`.

## Training

`lib/exercises.ts` is the source of truth for the 85-exercise library — name, muscle group,
equipment, level, cues, common mistakes and the §8.1 progression chains (push-up → diamond →
archer → pseudo-planche; dead hang → … → weighted pull-up; squat → … → pistol, plus the §8.2 ab
chains). Push it with:

```bash
npm run seed:exercises
```

It upserts on id, so it is safe to re-run; ids are stable because `workout_sets.exercise_id`
references them.

Session plans are **derived, not stored**: the split rotation (3 full body, 4 upper/lower,
5 hybrid, 6 PPL) picks the day from how many sessions are already finished, and exercises are
filtered to the equipment the user can actually reach. Changing equipment or training mode takes
effect on the next session with no migration.

The logger writes one set at a time, so nothing is lost if the phone dies. PRs are resolved when
the session is finished, against every set ever logged for that exercise — estimated 1RM (Epley)
for weighted work, best single-set reps for bodyweight. Finishing a session ticks off the workout
task for the day.

A third live-schema correction landed here: `workout_sessions` uses
`session_date / started_at / finished_at / plan_day` (duration derived, volume computed) and
`workout_sets` uses `set_no`, carries its own `user_id` and has a `duration_sec` column.
`supabase/schema.sql` had both wrong and is now fixed.

## AI plans

`POST /api/ai/plan` generates a workout, diet or skincare plan for a week. The §4 pipeline is
strict: strip fences → JSON.parse → zod validate → §10 guardrail check → save, retrying once with
the failure reasons fed back to the model before giving up.

| File | Role |
| --- | --- |
| `lib/ai/schemas.ts` | Response shapes, fence stripping, parse + validate |
| `lib/ai/prompts.ts` | System and user prompts; profile and recent data as JSON |
| `lib/ai/guardrails.ts` | §10 enforcement on model output |
| `lib/ai/pipeline.ts` | The retry loop |
| `lib/ai/fallback.ts` | Template plans shown when generation is rejected |
| `lib/ai/usage.ts` | Server-side rate limits via `ai_usage` |

Guardrails reject banned substances, prescription medication, dehydration cuts, extreme fasting,
jaw-device and mewing claims, and any shaming or "earn your food" framing — searched across every
nested string, not just top-level notes. They also enforce the calorie floors, the under-18 rules
(no supplements, no max-effort testing, ±250 kcal), the one-new-active skincare rule, and a
dermatologist referral where the plan describes severe acne. A rejected plan is logged in
`ai_plans.content.rejections` and the template is shown instead. Failed generations do not
consume the user's quota.

### Provider configuration

CLAUDE.md §1 specifies the Claude API; production runs on **DeepSeek** (`lib/ai/client.ts`):
`DEEPSEEK_MODEL` for plans and check-ins, `DEEPSEEK_MODEL_FAST` for meal estimates. Without a
key (or with one the provider rejects) every route still works and returns the template plan.

What the model receives: profile metrics (sex, age, height, weight, goal, training setup, diet,
targets), summaries of recent logs, and the text typed for that request. Never sent: photos,
username, display name, email. The privacy policy states exactly this; keep them in sync.

Rate limits (`lib/ai/usage.ts`) are checked **before** the model call and recorded after a
successful one: 3 plans per type per week, 1 check-in per week, 30 meal estimates per day.
`e2e/ai-limits.spec.ts` pins them: signed-out calls get 401, an exhausted quota gets 429 on all
five route/type combinations, and refusals are not charged.

## Nutrition

`/nutrition` shows the three §8.5 rings (calories, protein, water) and offers all three logging
routes:

1. **Tick a meal off the diet plan** — pulls the macros from the active `ai_plans` diet plan for
   the current week.
2. **Quick add** — Indian presets filtered by diet type, with mess items first in hostel mode,
   plus a free-form calories/protein form.
3. **Describe a meal** — `POST /api/ai/meal-estimate` (30/day) turns "2 roti, dal, paneer 100g"
   into items and macros that the user confirms before anything is written.

Every write re-derives the protein, calorie and water tasks from the day's totals rather than
toggling them, so removing an entry un-ticks the task again.

`food_entries.source` is constrained by the live database to exactly `manual`, `plan` and
`ai_estimate` — which map onto those three routes. `supabase/schema.sql` had it wrong and is
now corrected.

## Body tracking

`/body` covers §8.6: a weight chart, tape measurements, and progress photos.

Daily scale weight is noise, so the chart draws the **7-day moving average** and hides the daily
readings behind a toggle. The average is computed by date rather than by row count, so a gap in
logging widens the window instead of silently skipping days. Saving a weight also updates
`profiles.weight_kg`, which the calorie maths reads.

Measurements merge rather than overwrite — a blank field keeps whatever is already saved for that
day — and the body-fat estimate is recomputed from the tape on every write, so it can never drift
from the numbers it came from.

### Photos

Private bucket, `{user_id}/{date}-{angle}.jpg`, angles constrained by the database to
`front | side | back | face`. Verified against the live project: an unsigned fetch is refused,
storage RLS blocks a write into another user's folder, and deleting removes both the row and the
file.

URLs are signed for 60 seconds (§11). Two consequences the code handles explicitly: photos load
**eagerly**, because a lazily loaded photo would often request an already expired link; and a
failed load offers a refresh that re-renders with freshly signed URLs rather than showing a broken
image.

The upload form ghosts the previous shot behind the new one for alignment, and a `clip-path`
slider wipes between the earliest and latest photo for each angle.

## Face

`/face` carries both face modules and shows only the ones the user switched on.

**Skin (§8.3)** — a daily log (AM/PM routine, breakout score 0-5, dairy, notes), a weekly trend
chart, the AM/PM routine builder, and the four permitted OTC actives with starting doses and
cautions. Completing a routine ticks its daily task; clearing it un-ticks again.

The correlation card pairs breakout score against sleep, water, junk-food adherence and dairy.
It is built to under-claim: nothing is shown below seven paired days, a weak relationship reports
"no clear link" rather than a number, a flat series returns null instead of a fake zero, and the
card is labelled **"Correlation, not proof."** Tests assert the summaries never use causal wording.

Sustained severe scores, or notes mentioning cysts, nodules or scarring, raise a dermatologist
referral. No prescription medication is ever named — a test greps the whole module for it.

**Jawline (§8.4)** — leads with what actually drives it (facial fat, neck and posture, fixed bone
structure), ties to the body-fat trend, and gives light progressive neck and posture drills that
tick the `neck_posture` task. A "not recommended" section names jaw devices, mewing and
bone-reshaping claims and says why. Tests assert none of it is ever promoted.

## Sleep, recovery and mind

**Sleep (§8.7)** — a bed/wake/quality card on `/today`. Duration handles the midnight wrap and
refuses implausible nights rather than storing a misleading number; the night is attributed to the
day the user woke up. Hitting 7-9 hours ticks the sleep task.

**Recovery (§8.7)** — a 0-100 score from sleep hours, sleep quality, soreness and the previous
day's session RPE, shown in the `/today` header. Missing inputs are dropped and the remaining
weights renormalised, so logging only sleep gives a usable number instead of an artificially low
one, and a rest day is not punished for having no session. A low score tells the user to go
lighter.

**Mind, spirit and work (§8.8)** — count-up timers on minute-based tasks that log straight into
them (derived from a start timestamp, so a backgrounded tab stays accurate), an 18-chapter Gita
tracker, and a content log with platform and link. Platforms are constrained by the database to
`youtube | instagram | other`.

### A rule the checklist was getting backwards

"Social media under 30 min" (§9) is a **cap**: it is satisfied by staying *below* its target, not
by reaching it. Every other minute task is a floor. `lib/tasks/kinds.ts` makes that distinction
explicit, `setTaskValue` applies it, and cap tasks get no timer — timing a limit makes no sense.

## Weekly check-in and auto-adjust

`/checkin` reviews the week once per week (the database enforces that with a unique key on
`(user_id, week)`) and adjusts the calorie target.

The important design point: **§6 decides the number, not the model.** `lib/calc/adjust.ts`
computes the adjustment deterministically from the 7-day weight average before the model is
asked — faster than 1%/week loss adds 150 kcal, two flat weeks cut 150, a bulk gaining over
0.5 kg/week trims 100. The model's suggestion is bounded to that range and then reconciled:
it may *soften* a change in the same direction but never amplify one and never reverse it. The
result is re-clamped by the §10 guardrails, so an adjustment can never cross a calorie floor.

When the model is unavailable or its answer is rejected, a rules-based review is written from the
numbers and labelled as such. Reporting pain makes "drop what aggravates it and see a healthcare
professional" the first change, in both the AI and the fallback paths.

Each check-in stores the full input snapshot, so a past review can be re-read against the numbers
it was actually based on.

## Stats and achievements

`/stats` shows a 13x7 completion heatmap for the whole arc (shaded with the 80% streak bar as its
own step, so a glance shows which days actually banked), the weight trend, session volume, totals,
and a breakdown of where the points came from. `/achievements` lists all twelve §8.11 badges with
earned ones first.

The **Abs ETA** card (§8.2) projects weeks from the current body-fat estimate to the range where
abs usually show, at the current rate of loss. It is shown as a range, it says the estimate is
good to about four points either way, and it refuses to project at all while weight is steady or
rising rather than inventing a date.

### Badges are granted server-side

The live database has **no INSERT policy on `achievements`** for ordinary users. That is a
safeguard rather than a gap: badges appear on the public profile (§8.12), so a user must not be
able to award themselves one. `lib/stats/load.ts` grants them with the service-role client,
always scoped to the authenticated user id, and evaluation is idempotent so it can run on every
page load.

## Account, privacy and legal

- `/privacy` and `/terms` are public, linked from the signup form, the landing footer, the
  leaderboard, public profiles, the 404 page and Settings. Shared facts live in `lib/legal.ts`;
  set `contactEmail` there to publish a contact address.
- Settings → **Public profile** on/off, **Change password** (current password re-checked with a
  throwaway client), **Export my data** (`GET /api/account/export`: every user table read through
  the user's own session, push-subscription keys redacted, photo paths listed), **Delete account**
  (type `DELETE`; removes every object under `{user_id}/` in the `progress` bucket, then the auth
  user, which cascades to every table).
- `lib/account/tables.ts` is the single list of user tables shared by export and delete.

## Errors, metadata and share images

- `app/not-found.tsx` (branded 404), `app/error.tsx` (route errors, `retry()`),
  `app/global-error.tsx` (root layout failures; brings its own `<html>`).
- Every page sets a title + description. `metadataBase` comes from `lib/site.ts`.
- Generated Open Graph images: `app/opengraph-image.tsx` (default), `app/leaderboard/opengraph-image.tsx`
  (live top 3, 5 min), `app/u/[username]/opengraph-image.tsx` (day, streak, badges; generic card for
  private/unknown users, so it never confirms an account exists).

## Security

- **RLS audit** — `npx tsx scripts/rls-audit.mts` creates a victim (one row in every user table +
  a photo) and an attacker, then probes every table as anon and as the attacker: read, insert as
  victim, update, delete. It also checks server-written tables (`achievements`, `reminder_log`,
  `ai_usage` quota resets), reference tables, `signup_attempts`, the `public_profiles` column
  list, the private bucket (download, sign, list, upload, delete), and fails if PostgREST exposes
  any relation the audit does not cover. Last run: **195/195 checks**.
- **Headers** (`next.config.ts`) — `X-Frame-Options: DENY`, `nosniff`, strict referrer,
  `Permissions-Policy`, COOP, no `X-Powered-By`, and a **report-only** CSP built in
  `lib/security/csp.ts`. Violations go to `/api/csp-report` and appear in the Vercel runtime
  logs as `[csp] ...`. Once those stay quiet, rename the header to `Content-Security-Policy`.
- **Signup abuse** — 30 signups per IP per hour, counted in `signup_attempts` by HMAC'd IP.

## Deploy

1. Push to GitHub. Vercel → import the repo (framework: Next.js) → add every variable from the
   table above for Production → deploy. Pushes to `main` redeploy.
2. Supabase → Authentication → URL configuration: Site URL = the Vercel domain; add
   `https://<domain>/auth/callback` to the redirect allow-list.
3. Google sign-in: enable the provider in Supabase and register the Supabase callback URL in
   Google Cloud OAuth.
4. Add the two Vault secrets, then run the migrations in order (above).
5. VAPID keys: `npx web-push generate-vapid-keys` → `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
6. Smoke test: `E2E_BASE_URL=https://<domain> npm run test:e2e`, then
   `npx tsx scripts/rls-audit.mts`. Both clean up after themselves.

<!-- LIGHTHOUSE -->

## Phases

Build one phase at a time from `CLAUDE.md` §13. Phases 1 (scaffold + auth), 2 (onboarding + calc
engine), 3 (today checklist + streaks + points) 4 (task management + goal presets + modules)
5 (exercise library + workout logger), 6 (AI plans),
7 (nutrition), 8 (body tracking + photos), 9 (face modules),
10 (sleep, recovery and mind timers), 11 (weekly check-in + auto-adjust)
12 (stats + achievements), 13 (leaderboard + public profiles), 14 (PWA, push reminders, cron) and
15 (polish + launch readiness) are done.
