/**
 * Copies every progress photo from the old Supabase project to the new one.
 * A database dump carries the storage.objects rows but not the files.
 * See docs/region-migration.md, step 6.
 *
 *   OLD_SUPABASE_URL=… OLD_SUPABASE_SERVICE_ROLE_KEY=… \
 *   NEW_SUPABASE_URL=… NEW_SUPABASE_SERVICE_ROLE_KEY=… \
 *   npx tsx scripts/region-migration/copy-storage.mts [--dry-run]
 *
 * Reads only these four variables, never .env.local, so it cannot copy a
 * project onto itself by accident. Idempotent: uploads use upsert.
 */
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'progress';
const dryRun = process.argv.includes('--dry-run');

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const oldUrl = env('OLD_SUPABASE_URL');
const newUrl = env('NEW_SUPABASE_URL');
if (new URL(oldUrl).host === new URL(newUrl).host) throw new Error('OLD and NEW point at the same project.');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const from = createClient(oldUrl, env('OLD_SUPABASE_SERVICE_ROLE_KEY'), opts).storage.from(BUCKET);
const to = createClient(newUrl, env('NEW_SUPABASE_SERVICE_ROLE_KEY'), opts).storage.from(BUCKET);

/** Photos live at {user_id}/{date}-{angle}.jpg: one folder level. */
async function listAll(prefix: string): Promise<{ name: string; id: string | null }[]> {
  const out: { name: string; id: string | null }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await from.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

let copied = 0;
let failed = 0;
for (const folder of await listAll('')) {
  if (folder.id !== null) continue; // a file at the root: not a user folder
  for (const file of await listAll(folder.name)) {
    if (file.id === null) continue;
    const path = `${folder.name}/${file.name}`;
    if (dryRun) {
      console.log('would copy', path);
      copied++;
      continue;
    }
    const { data: blob, error: dlError } = await from.download(path);
    if (dlError || !blob) {
      console.error('download failed', path, dlError?.message);
      failed++;
      continue;
    }
    const { error: upError } = await to.upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' });
    if (upError) {
      console.error('upload failed', path, upError.message);
      failed++;
      continue;
    }
    copied++;
  }
}

console.log(`${dryRun ? 'Dry run: ' : ''}${copied} files ${dryRun ? 'to copy' : 'copied'}, ${failed} failed.`);
process.exit(failed ? 1 : 0);
