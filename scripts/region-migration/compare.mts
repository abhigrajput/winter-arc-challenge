/**
 * Row counts per table, auth users and stored photos, old project vs new.
 * Run after the restore and the storage copy: every line must say "ok".
 * See docs/region-migration.md, step 7.
 *
 *   OLD_SUPABASE_URL=… OLD_SUPABASE_SERVICE_ROLE_KEY=… \
 *   NEW_SUPABASE_URL=… NEW_SUPABASE_SERVICE_ROLE_KEY=… \
 *   npx tsx scripts/region-migration/compare.mts
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(env('OLD_SUPABASE_URL'), env('OLD_SUPABASE_SERVICE_ROLE_KEY'), opts);
const newDb = createClient(env('NEW_SUPABASE_URL'), env('NEW_SUPABASE_SERVICE_ROLE_KEY'), opts);

/** Legacy JWT keys go in both headers; new sb_secret_ keys only in apikey. */
function restHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

/** Every relation PostgREST exposes (tables and views). */
async function relations(url: string, key: string): Promise<string[]> {
  const res = await fetch(`${url}/rest/v1/`, { headers: restHeaders(key) });
  const spec = (await res.json()) as { definitions?: Record<string, unknown> };
  return Object.keys(spec.definitions ?? {}).sort();
}

async function count(db: SupabaseClient, table: string): Promise<number | string> {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true });
  return error ? `error: ${error.message}` : (n ?? 0);
}

async function authUsers(db: SupabaseClient): Promise<number> {
  let total = 0;
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    total += data.users.length;
    if (data.users.length < 1000) return total;
  }
}

async function photos(db: SupabaseClient): Promise<number> {
  const bucket = db.storage.from('progress');
  const { data: folders } = await bucket.list('', { limit: 1000 });
  let total = 0;
  for (const f of folders ?? []) {
    if (f.id !== null) continue;
    const { data } = await bucket.list(f.name, { limit: 1000 });
    total += (data ?? []).filter((o) => o.id !== null).length;
  }
  return total;
}

const oldRel = await relations(env('OLD_SUPABASE_URL'), env('OLD_SUPABASE_SERVICE_ROLE_KEY'));
const newRel = await relations(env('NEW_SUPABASE_URL'), env('NEW_SUPABASE_SERVICE_ROLE_KEY'));
let bad = 0;
const line = (label: string, a: number | string, b: number | string) => {
  const ok = a === b;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'DIFF'}  ${label.padEnd(22)} old ${String(a).padStart(6)}  new ${String(b).padStart(6)}`);
};

for (const rel of [...new Set([...oldRel, ...newRel])].sort()) {
  line(rel, oldRel.includes(rel) ? await count(oldDb, rel) : 'missing', newRel.includes(rel) ? await count(newDb, rel) : 'missing');
}
line('auth.users', await authUsers(oldDb), await authUsers(newDb));
line('storage progress/*', await photos(oldDb), await photos(newDb));

console.log(bad ? `\n${bad} difference(s).` : '\nAll counts match.');
process.exit(bad ? 1 : 0);
