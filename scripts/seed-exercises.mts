/**
 * Pushes lib/exercises.ts into the `exercises` table.
 *
 * Idempotent: rows are upserted on their primary key, so running it again
 * updates cues, mistakes and progression links without creating duplicates or
 * breaking workout_sets that reference an exercise id.
 *
 *   npm run seed:exercises
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { toDatabaseRows } from '../lib/exercises';

function loadEnv(file: string): void {
  let contents: string;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    return;
  }

  // Split on CRLF as well: JavaScript's "." does not match a carriage return,
  // so a trailing \r would stop the value matching at all.
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

// Service role: `exercises` is reference data and is read-only to users.
const supabase = createClient(url, serviceKey);

const rows = toDatabaseRows();

// Parents must exist before children reference them, so insert the rows with no
// progression_of first.
const roots = rows.filter((r) => r.progression_of === null);
const children = rows.filter((r) => r.progression_of !== null);

for (const [label, batch] of [
  ['roots', roots],
  ['progressions', children],
] as const) {
  if (batch.length === 0) continue;
  const { error } = await supabase.from('exercises').upsert(batch, { onConflict: 'id' });
  if (error) {
    console.error(`Failed to seed ${label}:`, error.message);
    process.exit(1);
  }
  console.log(`seeded ${batch.length} ${label}`);
}

const { count } = await supabase.from('exercises').select('id', { count: 'exact', head: true });
console.log(`exercises table now holds ${count} rows`);
