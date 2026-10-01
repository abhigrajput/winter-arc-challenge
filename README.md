# Winter Arc

90-day self-transformation OS. Daily checklist, workout logger, nutrition + macros, body
measurements, progress photos, AI coach, stats, achievements, global leaderboard.

Cold, short, zero fluff. Dark theme only. Mobile-first. Installable PWA.

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind + shadcn/ui · Supabase (Auth, Postgres,
RLS, private Storage) · Claude API · zod · Vitest · Vercel.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |

All four must pass before a commit.

## Database

`supabase/schema.sql` documents the live Supabase schema. The project in `.env.local` is already
provisioned: 20 tables with RLS enforced, `task_templates` seeded with the 24 default tasks, and a
private `progress` storage bucket.

`lib/supabase/types.ts` mirrors that schema. It was generated from the live PostgREST spec and then
hand-annotated with the string unions the app relies on. When a table changes, update both files.

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

## Phases

Build one phase at a time from `CLAUDE.md` §13. Phases 1 (scaffold + auth), 2 (onboarding + calc
engine), 3 (today checklist + streaks + points) 4 (task management + goal presets + modules)
and 5 (exercise library + workout logger) are done.
