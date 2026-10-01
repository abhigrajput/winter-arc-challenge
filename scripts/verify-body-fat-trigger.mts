/**
 * Checks that the live compute_navy_body_fat() trigger agrees with
 * lib/calc/bodyfat.ts on every fixture in lib/calc/bodyfat-fixtures.ts.
 *
 * Run it once after applying supabase/migrations/pre-phase-13.sql:
 *
 *   npm run verify:bodyfat
 *
 * It creates one throwaway auth user per sex, writes a body_measurements row
 * for each fixture, reads back the body_fat_pct the database computed, and
 * compares. The users and their rows are deleted at the end, pass or fail.
 *
 * Needs the service role key, because it creates and deletes auth users.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { navyBodyFat } from '../lib/calc/bodyfat';
import { BODY_FAT_FIXTURES } from '../lib/calc/bodyfat-fixtures';

function loadEnv(file: string): void {
  let contents: string;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!.trim();
    }
  }
}

loadEnv('.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = Date.now();
const createdUsers: string[] = [];

/** A user whose profile carries the sex and height a fixture needs. */
async function makeUser(label: string, sex: 'male' | 'female', heightCm: number): Promise<string> {
  const { data, error } = await supabase.auth.admin.createUser({
    email: `bodyfat-${label}-${stamp}@example.invalid`,
    password: `probe-${stamp}-${Math.random().toString(36).slice(2)}`,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  createdUsers.push(data.user.id);

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ sex, height_cm: heightCm, onboarded: true })
    .eq('id', data.user.id);
  if (profileError) throw new Error(`profile update failed: ${profileError.message}`);

  return data.user.id;
}

async function cleanUp(): Promise<void> {
  for (const id of createdUsers) {
    await supabase.auth.admin.deleteUser(id);
  }
}

async function main(): Promise<void> {
  let failures = 0;

  // Each fixture carries its own height, so it gets its own user. Dates are
  // spread because body_measurements is keyed on (user_id, log_date).
  for (const [index, fixture] of BODY_FAT_FIXTURES.entries()) {
    const userId = await makeUser(String(index), fixture.sex, fixture.heightCm);
    const logDate = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('body_measurements')
      .insert({
        user_id: userId,
        log_date: logDate,
        waist_cm: fixture.waistCm,
        neck_cm: fixture.neckCm,
        hip_cm: fixture.hipCm ?? null,
        // Deliberately wrong: the trigger must overwrite it, or ignore it in
        // the cases where no estimate is possible.
        body_fat_pct: -1,
      })
      .select('body_fat_pct')
      .single();

    if (error) {
      console.error(`FAIL ${fixture.label}: insert rejected — ${error.message}`);
      failures += 1;
      continue;
    }

    const fromDb = data.body_fat_pct === null ? null : Number(data.body_fat_pct);
    const fromTs = navyBodyFat(fixture);

    // Where no estimate is possible the trigger leaves the submitted value
    // alone, so the sentinel coming back unchanged is the expected outcome.
    const expected = fromTs === null ? -1 : fromTs;

    if (fromDb === expected) {
      console.log(`ok   ${fixture.label}: ${fromTs === null ? 'no estimate' : `${fromDb}%`}`);
    } else {
      console.error(`FAIL ${fixture.label}: database ${fromDb}, TypeScript ${expected}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} of ${BODY_FAT_FIXTURES.length} fixtures disagree.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${BODY_FAT_FIXTURES.length} fixtures match lib/calc/bodyfat.ts.`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(cleanUp);
