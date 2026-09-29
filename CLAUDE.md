WINTER ARC — Advanced Project Brief for Claude Code
90-day self-transformation OS. Body (gym / home gym), abs, face (skin + jawline), nutrition, sleep, mind, spirit, work. One app: daily checklist, real workout logger, nutrition + macro tracking, body measurements, progress photos, AI coach (plans + weekly check-ins), stats, achievements, global leaderboard.

UI tone: cold, short, zero fluff. Dark theme. Mobile-first. Installable PWA.


1. Stack (do not deviate)
Next.js 14+ App Router, TypeScript strict, Tailwind, shadcn/ui
Supabase: Auth (email + Google), Postgres, RLS, Storage (private bucket progress)
Claude API via @anthropic-ai/sdk, server-only
zod (validate every AI response + every form), react-hook-form
recharts, date-fns, date-fns-tz, framer-motion (minimal)
Web Push via web-push + service worker for reminders
Vercel (hosting + Cron Jobs)
2. Env vars
NEXT_PUBLIC_SUPABASE_URL=

NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=        # server only: cron jobs

ANTHROPIC_API_KEY=

ANTHROPIC_MODEL=claude-sonnet-5-5

NEXT_PUBLIC_VAPID_PUBLIC_KEY=

VAPID_PRIVATE_KEY=

CRON_SECRET=
3. Folder structure
app/

  (marketing)/page.tsx

  (auth)/login, auth/callback

  (app)/today, train, train/[sessionId], nutrition, body, face, plan,

        checkin, stats, leaderboard, achievements, tasks, settings

  u/[username]

  api/ai/plan, api/ai/checkin, api/ai/meal-estimate, api/cron/reminders, api/push/subscribe

lib/

  supabase/{client,server,middleware}.ts

  calc/{tdee,macros,bodyfat,progression,streak}.ts   # pure functions, unit tested

  goals.ts        # goal presets

  ai/{prompts,schemas,guardrails}.ts

  exercises.ts    # seed data

components/

supabase/schema.sql
4. Hard rules
log_date = user's local date via profiles.timezone (default Asia/Kolkata). Never server UTC for "today".
DB accepts daily logs only for yesterday/today/tomorrow. No backfilling.
Streak day = ≥ 80% of that day's active tasks done. STREAK_THRESHOLD = 0.8.
Points: 10/task, +20 full day, +15 workout session logged, +25 weekly check-in submitted.
Leaderboard ranks discipline only (points, streak). NEVER rank by weight, calories, body fat, or photos.
All math in lib/calc/* as pure functions with Vitest tests. No math inside components.
Every AI response: strip fences → JSON.parse → zod validate → guardrail check → save. Retry once, then 502.
Server components by default. Client components only for interactivity.


5. Onboarding (multi-step, save each step)
Username, display name, timezone, start date
Sex, age, height, weight, target weight, activity level
Primary goal: fat_loss | lean_bulk | recomp | six_pack | discipline | spiritual
Add-on modules (multi-select): abs, face_skin, jawline, running, content_creator
Training mode: gym | home | hybrid. Equipment checklist (pull-up bar, dumbbells + max kg, bands, bench, barbell, machines)
Fitness level, available days/week (3–6), session length (30/45/60/90 min)
Diet type: veg | egg | nonveg. Allergies/dislikes (free text). Budget: hostel | normal
Wake time, sleep target, reminder times
Baseline: waist, neck (+hip for women), optional front/side/back/face photos (private)
Result screen: TDEE, calorie target, macros, estimated body fat, projected 90-day range → "Start Day 1"
6. Core calculations (lib/calc)
BMR: Mifflin-St Jeor. Men 10w + 6.25h − 5a + 5, women … − 161.
TDEE: BMR × activity (1.2 / 1.375 / 1.55 / 1.725).
Calorie target by goal:
fat_loss / six_pack: TDEE − 300 to −500. Cap loss at 1% bodyweight/week.
lean_bulk: TDEE + 250 to +350. Target gain 0.25–0.5 kg/week.
recomp: TDEE − 10%.
discipline / spiritual: maintenance.
Macros: protein 1.6–2.2 g/kg, fat ≥ 0.6 g/kg, rest carbs.
Body fat estimate: US Navy formula (waist, neck, height; + hip for women). Label as estimate ±3–4%.
Auto-adjust (weekly): 7-day weight average vs previous week. Loss too fast → +150 kcal. Stalled 2 weeks → −150 kcal. Bulk gaining too fast → −100 kcal.
Progressive overload: hit top of rep range on all sets → next session +2.5 kg (gym) or next progression step (home).
Water: 35 ml/kg, min 2.5 L.
7. 90-day structure
Weeks 1–4 Foundation: technique, habits, volume moderate. Week 4 = deload.
Weeks 5–8 Build: volume up, progression aggressive. Week 8 = deload.
Weeks 9–12 Peak: highest intensity, tighter diet for fat-loss goals.
Week 13 Test: rep-max tests (bodyweight/moderate loads only), final measurements + photos, before/after report.
8. Modules
8.1 Training — gym + home gym
Exercise library (seeded, ~80 exercises): name, muscle group, equipment, level, cues, common mistakes, progression/regression chain.
Home progressions: push-up → diamond → archer → pseudo-planche; dead hang → scap pull → negative → band-assisted → pull-up → weighted; squat → split squat → Bulgarian → pistol progression.
Surya Namaskar counted as mobility/warm-up block.
Splits generated from days/week: 3 = full body, 4 = upper/lower, 5 = upper/lower/PPL hybrid, 6 = PPL.
Workout logger /train/[sessionId]: exercise list from plan, log sets (reps, kg, RPE), rest timer with vibration, swap exercise (same muscle + available equipment), previous-session numbers shown inline, auto PR detection (est. 1RM via Epley for weighted, max reps for bodyweight).
Session summary: volume, PRs, duration → auto-completes home_workout/gym_workout task.
8.2 Abs / six-pack
Truth in UI: visible abs depend mainly on body fat (roughly men 10–13%, women 17–21%). Ab training builds the muscle; diet reveals it.
Abs circuit 3–4×/week: progression hollow hold → hanging knee raise → hanging leg raise → toes-to-bar; plank → RKC plank → ab wheel; weighted cable/dumbbell crunch for gym.
"Abs ETA" card: current est. BF% → target BF% at current weekly loss rate → projected weeks. Show as range.
8.3 Face — clear skin
Routine builder: AM (cleanser, moisturizer, sunscreen SPF 30+), PM (cleanser, moisturizer, optional one OTC active).
OTC actives only: benzoyl peroxide, salicylic acid, niacinamide, adapalene where OTC. One new product at a time, patch test, 2-week intro.
Daily skin log: AM/PM done, breakout score 0–5, optional face photo (private). Weekly trend chart.
Correlation card: breakout score vs sleep hours, water, sugar/junk task, dairy intake (user-toggled). Label: "correlation, not proof".
Rule: persistent/cystic acne, scarring, or sudden changes → "See a dermatologist." No prescription drug recommendations.
8.4 Face — jawline
Truth in UI: jawline definition = facial fat level + neck/posture + genetics (bone structure fixed after growth).
Features: body-fat trend, neck training (light neck curls/extensions, progressive, form videos), posture drills (chin tucks, wall angels), sodium/water tracking (puffiness), sleep.
Face photo comparison (same angle, same lighting prompt).
Do NOT promote: jaw exerciser devices (TMJ risk), "mewing" as proven, bone-changing claims.
8.5 Nutrition
Daily targets from §6. Rings: calories, protein, water.
Logging options: (a) tick meals from AI diet plan (auto-fills macros), (b) quick-add calories/protein, (c) AI text estimate: "2 roti, dal, paneer 100g" → /api/ai/meal-estimate returns items + macros, user confirms.
Indian food defaults, hostel/mess mode (mess thali + add-ons like eggs, curd, peanuts, soya chunks, whey optional).
Weight gain helpers: calorie-dense add-on list, shake recipes. Fat loss helpers: volume foods, protein-first plate.
8.6 Body tracking
Daily weight (optional), 7-day moving average chart (daily noise hidden by default).
Weekly measurements: waist, chest, arms, thighs, neck, hip. Auto BF% estimate.
Progress photos: front/side/back/face, private Storage bucket, signed URLs only, ghost-overlay of previous photo for alignment, before/after slider.
8.7 Sleep + recovery
Sleep log (bed, wake, quality 1–5). Target 7–9 h.
Recovery score (0–100) = sleep hours + quality + soreness + previous-day training load. Low score → workout card suggests lighter session.
8.8 Mind / spirit / work
Timers for reading, Gita, meditation, skill, editing → auto-complete tasks when timer target reached.
Gita tracker: chapter/verse progress (18 chapters).
Content tracker: posts published per week (YT/Insta), simple log with link.
Social-media limit: self-reported minutes.
8.9 AI Coach (Claude API)
Routes (all auth-required, rate-limited server-side via ai_usage table):

POST /api/ai/plan {type: "workout"|"diet"|"skincare", week} — 3/type/week.
POST /api/ai/checkin weekly — input: 7-day weight avg, measurements, adherence %, workout volume trend, sleep avg, breakout trend, user notes → output: verdict, 3 changes for next week, calorie adjustment (bounded by §6), exercise swaps. 1/week.
POST /api/ai/meal-estimate — 30/day. Prompts live in lib/ai/prompts.ts. Profile + recent data injected as JSON. Response schemas in lib/ai/schemas.ts.
8.10 Daily checklist /today
Tasks grouped: Discipline, Body, Face, Mind, Spirit, Work. Numeric tasks show progress bars. Auto-completion from logger/timers/nutrition. Header: Day X/90 · phase · streak · today % · recovery score. Full-day completion → bonus animation.
8.11 Achievements
First workout, 7/30/60/90-day streaks, 10 PRs, first pull-up, 100 Surya Namaskar total, 18 Gita chapters, 30 posts published, perfect week, 90-day finisher. Shown on public profile.
8.12 Leaderboard + social
Global weekly + all-time (points, streak). Public profile /u/[username]: day count, streak, achievements, completion heatmap. Body data and photos are never public.
8.13 Reminders (Web Push + Vercel Cron)
Wake-up, workout, water (every 2 h, opt-in), skincare PM, sleep wind-down, streak-at-risk (8 PM if < 50% done). Per-user toggles. Cron route protected by CRON_SECRET.


9. Default task templates (seeded)
slug
title
target
unit
module
wake_5am
Wake up by 5:00 AM
1
check
core
no_phone_morning
No phone after wake-up
60
min
core
surya_namaskar
Surya Namaskar
12
rounds
core
workout
Workout (gym/home plan)
1
check
core
abs_circuit
Abs circuit
1
check
abs
pullups
Pull-up practice
1
check
core
steps
Steps
10000
steps
core
running
Running
3
km
running
water
Water
3
L
core
protein
Hit protein target
1
check
core
calories
Stay in calorie range
1
check
core
no_junk
No junk / added sugar
1
check
core
sleep
Sleep 7–9 h
1
check
core
skincare_am
Skincare AM + sunscreen
1
check
face_skin
skincare_pm
Skincare PM
1
check
face_skin
neck_posture
Neck + posture drills
1
check
jawline
social_limit
Social media under 30 min
30
min
core
reading
Book reading
30
min
core
gita
Bhagavad Gita (read/listen)
20
min
core
temple
Temple visit
1
check
core
meditation
Meditation
15
min
core
content
Create content (YT/Insta)
1
check
content_creator
editing
Video editing
30
min
content_creator
skill
Learn a skill
60
min
core


Modules not selected → their tasks inserted inactive. Goal presets (lib/goals.ts) override targets:

fat_loss / six_pack: steps 12000–15000, abs module on.
lean_bulk: steps 8000, running optional, no_junk relaxed to "no junk before training".
recomp: steps 10000. Users can edit any target, disable any task, add custom tasks.
10. Safety guardrails (lib/ai/guardrails.ts + onboarding validation)
Block target weight giving BMI < 18.5. Show neutral message + suggest talking to a doctor.
Calories never below 1500 (men) / 1200 (women). Weekly loss capped at 1% bodyweight.
Age < 18: maintenance or mild surplus/deficit only (±250), no max-effort tests, no supplement mentions.
No steroids, SARMs, fat burners, prescription drugs, extreme fasts, sauna/dehydration cuts.
No "earn your food" or shame copy anywhere.
Injury/pain reported in check-in → AI removes aggravating exercises and suggests seeing a professional.
Fixed disclaimer on plan pages: "General guidance, not medical advice."
AI output failing guardrails → rejected, logged, fallback template plan shown.
11. Database
Full schema: supabase/schema.sql. RLS on every table. Progress photos in private bucket, path {user_id}/{date}-{angle}.jpg, signed URLs (60 s).
12. Quality bar
npm run build + npm run lint + npm test pass before every commit.
Vitest tests for all lib/calc/* functions and guardrails.
Lighthouse mobile ≥ 90. Loading, empty, and error states on every page.
No any. No secrets in client bundles.


13. Build phases
Run one phase at a time: "Build Phase N from CLAUDE.md". Commit after each.

Scaffold + auth — Next.js, Tailwind, shadcn, Supabase SSR clients, middleware, /login, /auth/callback, protected layout.
Onboarding + calc engine — §5 flow, lib/calc/* with tests, result screen.
Today checklist + streaks + points — §8.10, ensure_day_logs, streak, points.
Task management + goal presets + modules — /tasks, lib/goals.ts.
Exercise library + workout logger — seed exercises, §8.1 logger, rest timer, PRs, swaps.
AI plans — workout/diet/skincare generation, guardrails, /plan.
Nutrition — §8.5 rings, meal ticks, quick add, AI meal estimate.
Body tracking + photos — §8.6, Storage bucket, before/after slider.
Face modules — §8.3 + §8.4, skin log, correlations, jawline tracker.
Sleep + recovery + mind timers — §8.7, §8.8.
Weekly AI check-in + auto-adjust — §8.9 check-in, §6 auto-adjust.
Stats + achievements — charts, heatmaps, Abs ETA, badges.
Leaderboard + public profiles — §8.12.
PWA + push reminders + cron — §8.13.
Polish + deploy — metadata, OG images, 404, Lighthouse, Vercel.
14. Deploy checklist
Push to GitHub.
Vercel → import repo → add all env vars → deploy.
Supabase Auth → Site URL = Vercel domain; add https://<domain>/auth/callback.
Google Cloud OAuth → add Supabase callback URL.
vercel.json crons → /api/cron/reminders hourly.
Generate VAPID keys: npx web-push generate-vapid-keys.
Production smoke test: signup → onboarding → log workout → tick meals → upload photo → leaderboard.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
