# Region migration: Sydney (ap-southeast-2) → Mumbai (ap-south-1)

Moves the Supabase project next to the users (India) and the Vercel functions with it
(`syd1` → `bom1`). Nothing here has been run. Follow the steps in order.

**Downtime:** about 30 minutes. Nothing written to the old project after step 3 is carried
over, so don't use the app between step 3 and step 10.

**Rollback:** the old project is never modified apart from switching its cron jobs off
(step 3). Until step 12, rolling back means reverting the Vercel env vars and `vercel.json`,
then turning the old cron jobs back on (see "Rollback" at the end).

---

## Why a dump, not "schema.sql + migrations"

Replaying the repo's SQL on a fresh project does **not** reproduce production:

- `get_leaderboard` (used by `/`, `/leaderboard` and its share image), `ensure_day_logs`,
  `apply_modules` and `ai_remaining` exist only in the live database. None of them are in the repo.
- `phase-13.sql` moves the live `get_streak` into `private.get_streak_unchecked`. Its body was
  provisioned with the project and is not in the repo either.
- `schema.sql` says so itself: RLS policy bodies and CHECK constraints could not be read back, so
  the policies there are *intended* definitions, not a copy of what is live.

So the database is copied with `pg_dump` (via the Supabase CLI), schema and data together. That
also carries the users, with their password hashes, so everyone keeps their password. The repo
migrations are then re-run only for what a dump cannot carry: pg_cron jobs, Vault secrets and
storage files.

---

## 0. Tools (once)

- **Docker Desktop**, running. `supabase db dump` runs `pg_dump` in a container.
- **psql** 15 or newer, on `PATH` (the PostgreSQL command-line tools). Check with `psql --version`.
- **Supabase CLI** through npx: `npx supabase@2 --version`.

Commands below are PowerShell. In Git Bash, use `export NAME=value` instead of `$env:NAME = 'value'`.

## 1. Create the Mumbai project

Supabase Dashboard → New project:

- Region: **South Asia (Mumbai) — ap-south-1**.
- Same organisation and plan as the old project.
- Save the database password in your password manager. It's needed below.

Then Project Settings → Infrastructure: check the new Postgres version is **the same or newer**
than the old project's. A dump never restores into an older server.

## 2. Connection strings

For **both** projects: Dashboard → **Connect** → **Session pooler** (port 5432), URI form.
The direct `db.<ref>.supabase.co` host is IPv6-only and fails on most home networks. Do not use
the transaction pooler (port 6543) for dumps.

```powershell
$env:OLD_DB_URL = 'postgresql://postgres.<old-ref>:<old-db-password>@<old-pooler-host>:5432/postgres'
$env:NEW_DB_URL = 'postgresql://postgres.<new-ref>:<new-db-password>@<new-pooler-host>:5432/postgres'
```

Also note, for both projects, from Project Settings → API Keys: the project URL, the anon (or
publishable) key and the service_role (or secret) key.

## 3. Freeze the old project

Old project → SQL editor. Turn its cron jobs off, so reminders don't fire from two places and
`reminder_log` stops changing:

```sql
select cron.unschedule(jobname) from cron.job where jobname like 'winter-arc%';
select jobname from cron.job;  -- expect no winter-arc rows
```

Then capture the two things a schema dump leaves out, triggers on `auth.users` and policies
on `storage.objects`, as runnable SQL. Run each query, copy every output row, and save both into
one file, `post-restore.sql`, in the scratch folder from step 4:

```sql
-- a) triggers on auth.users (the signup trigger that creates profiles + user_tasks)
select pg_get_triggerdef(t.oid) || ';'
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

-- b) storage policies (the owner-only rule on the progress bucket)
select format(
  'drop policy if exists %I on %I.%I; create policy %I on %I.%I as %s for %s to %s%s%s;',
  policyname, schemaname, tablename, policyname, schemaname, tablename, permissive, cmd,
  array_to_string(roles, ', '),
  case when qual is not null then format(' using (%s)', qual) else '' end,
  case when with_check is not null then format(' with check (%s)', with_check) else '' end)
from pg_policies
where schemaname = 'storage';
```

Expect at least one trigger (`on_auth_user_created`) and the `progress: own files` policy.

## 4. Dump the old project

From a scratch folder **outside the repo** (the dump holds every user's data and password hashes):

```powershell
mkdir $HOME\winter-arc-migration; cd $HOME\winter-arc-migration
npx supabase@2 db dump --db-url $env:OLD_DB_URL -f roles.sql --role-only
npx supabase@2 db dump --db-url $env:OLD_DB_URL -f schema.sql
npx supabase@2 db dump --db-url $env:OLD_DB_URL -f data.sql --use-copy --data-only
```

Sanity check: `schema.sql` must contain `get_leaderboard`, `ensure_day_logs`,
`get_streak_unchecked` and `create schema` for `private`:

```powershell
Select-String -Path schema.sql -Pattern 'get_leaderboard|ensure_day_logs|get_streak_unchecked|SCHEMA "private"' | Select-Object -First 8
```

## 5. Prepare the new project, then restore

New project → Database → **Extensions**: enable **pg_cron** and **pg_net** (and **pgcrypto** if
it is not already on). They have to exist before the restore.

Restore everything in one transaction. Any error aborts the whole restore and leaves the project empty:

```powershell
psql --single-transaction --variable ON_ERROR_STOP=1 `
  --file roles.sql `
  --file schema.sql `
  --command 'SET session_replication_role = replica' `
  --file data.sql `
  --dbname $env:NEW_DB_URL
```

`session_replication_role = replica` stops triggers firing while the rows are loaded. Without
it, the signup trigger would try to re-seed every restored user.

Then apply the captured auth trigger and storage policies, and make sure the bucket exists:

```powershell
psql --variable ON_ERROR_STOP=1 --file post-restore.sql --dbname $env:NEW_DB_URL
psql --variable ON_ERROR_STOP=1 --dbname $env:NEW_DB_URL --command "insert into storage.buckets (id, name, public) values ('progress', 'progress', false) on conflict (id) do update set public = false;"
```

## 6. Vault, cron jobs, photos

**Vault.** Secrets are encrypted with a per-project key, so restored ones (if any) can't be
decrypted. Recreate them. New project → SQL editor; the cron secret is the **same** `CRON_SECRET`
that is already set in Vercel:

```sql
delete from vault.secrets where name in ('winter_arc_site_url', 'winter_arc_cron_secret');
select vault.create_secret('https://winter-arc-challenge-blue.vercel.app', 'winter_arc_site_url');
select vault.create_secret('<CRON_SECRET from Vercel>', 'winter_arc_cron_secret');
select name from vault.decrypted_secrets where name like 'winter_arc%';  -- expect 2 rows
```

**Cron jobs.** A dump does not carry `cron.job`. Re-schedule by running, in the new project's SQL
editor, **section 4 of `supabase/migrations/phase-14.sql`** (from `-- 4. pg_cron + pg_net` down to
`commit;`) and **the `cron.schedule` statement in `supabase/migrations/phase-15.sql`**. Both are
idempotent. Check:

```sql
select jobname, schedule, active from cron.job where jobname like 'winter-arc%';
-- expect: winter-arc-reminders, winter-arc-reminder-log-prune, winter-arc-signup-attempts-prune
```

These jobs call the production URL, which keeps reading the old database until step 9. In that
gap, reminders are sent from the old data exactly as before, just triggered from the new project.
There are no double sends, because the old jobs were switched off in step 3.

**Photos.** The dump carries the `storage.objects` rows but not the files. Copy them with the
service keys (from the repo root; reads only these variables, never `.env.local`):

```powershell
$env:OLD_SUPABASE_URL = 'https://<old-ref>.supabase.co'
$env:OLD_SUPABASE_SERVICE_ROLE_KEY = '<old service key>'
$env:NEW_SUPABASE_URL = 'https://<new-ref>.supabase.co'
$env:NEW_SUPABASE_SERVICE_ROLE_KEY = '<new service key>'
npx tsx scripts/region-migration/copy-storage.mts --dry-run
npx tsx scripts/region-migration/copy-storage.mts
```

## 7. Verify the copy

Same four variables as step 6:

```powershell
npx tsx scripts/region-migration/compare.mts
```

Every table, `auth.users` and `storage progress/*` must say `ok`. Then, in the new project's SQL editor:

```sql
select count(*) from pg_proc where pronamespace = 'private'::regnamespace;        -- ≥ 1 (get_streak_unchecked)
select proname from pg_proc where proname in ('get_leaderboard','ensure_day_logs','apply_modules','ai_remaining','get_public_profile','get_streak','handle_new_user');  -- all 7
select count(*) from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;  -- ≥ 1
select relname from pg_class where relrowsecurity = false and relnamespace = 'public'::regnamespace and relkind = 'r';  -- expect no rows
```

## 8. Auth settings (dashboard; not part of any dump)

Open the old and new projects side by side and copy every non-default value. The app depends on these:

| Where (new project) | Setting |
| --- | --- |
| Authentication → Sign In / Providers → Email | Enabled. **Confirm email: OFF** (signup is instant). Min password length **8**, same as `MIN_PASSWORD` |
| Authentication → Sign In / Providers → Google | Off, as now (`AUTH_FEATURES.google = false`) |
| Authentication → URL Configuration → Site URL | `https://winter-arc-challenge-blue.vercel.app` |
| Authentication → URL Configuration → Redirect URLs | `https://winter-arc-challenge-blue.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, `http://localhost:3217/auth/callback` |
| Authentication → Emails → SMTP | Same provider as old, if one is set. Required before turning on `FORGOT_PASSWORD_ENABLED` |
| Authentication → Emails → Reset password template | Link: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/auth/reset` (see README "Forgot password") |
| Authentication → Rate Limits, Sessions, Attack Protection | Copy the old values |
| Project Settings → Data API → Exposed schemas | `public` (and `graphql_public` if it was there). **Never `private`** |

The new project has new JWT signing keys, so every existing session ends at cutover and users sign
in again with their usual password.

## 9. Cutover: Vercel env + region

Vercel → Project → Settings → Environment Variables. For **Production** (and Preview, if set
there), replace:

| Variable | New value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<new-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | new anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | new service_role / secret key |

Everything else stays: `CRON_SECRET`, `DEEPSEEK_*`, VAPID keys. If `SIGNUP_IP_SALT` is unset, the
signup counter's hash key changes with the service key. That's harmless, because the rows only matter for an hour.

Then, in the repo, point the functions at Mumbai and push. The push triggers the production build
that picks up the new env (`NEXT_PUBLIC_*` values are baked in at build time, so changing them
without a new build does nothing):

```diff
- "regions": ["syd1"]
+ "regions": ["bom1"]
```

```powershell
git commit -am "vercel: run functions in bom1, next to the Mumbai database"; git push
```

Update `.env.local` to the new project's three values too, so local dev, e2e and the audit
scripts talk to Mumbai.

## 10. Smoke test production

```powershell
curl.exe -sI https://winter-arc-challenge-blue.vercel.app/login | Select-String x-vercel-id   # expect ::bom1::
$env:E2E_BASE_URL = 'https://winter-arc-challenge-blue.vercel.app'; npm run test:e2e; Remove-Item Env:E2E_BASE_URL
npx tsx scripts/rls-audit.mts                                                                 # expect 0 failed
```

Then by hand: sign in with your real account, check streak, points, photos (they load through
signed URLs) and the leaderboard. Wait 15 minutes, then in the new project:

```sql
select status_code, created from net._http_response order by created desc limit 3;  -- 200s from /api/cron/reminders
```

## 11. Docs and memory of the move

- README: Cron + Vault example URL is unchanged. In "Performance", replace the `syd1` / ap-southeast-2
  note with `bom1` / ap-south-1, and re-run Lighthouse if you want fresh numbers.
- `supabase/schema.sql`: consider replacing it with the `schema.sql` dump from step 4 (it holds
  no data). That makes the repo a true copy of the live schema and closes the gap described at
  the top.

## 12. Decommission the old project (after a week of clean running)

Old project → Project Settings → General → **Pause project**. After another week, delete it.
Then delete `$HOME\winter-arc-migration`: it holds a full copy of user data.

---

## Rollback (any time before step 12)

1. Vercel env vars → put the three old values back; `vercel.json` → `"regions": ["syd1"]`; push.
2. Old project → SQL editor: re-run section 4 of `phase-14.sql` and the `cron.schedule` in
   `phase-15.sql` (its Vault secrets are untouched).
3. Anything written to the new project after cutover is not in the old one. Export those users'
   data from Settings first if it matters.
