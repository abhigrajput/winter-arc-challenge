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

## Phases

Build one phase at a time from `CLAUDE.md` §13. Phases 1 (scaffold + auth) and 2 (onboarding +
calc engine) are done.
