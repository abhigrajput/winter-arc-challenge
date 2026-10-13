/**
 * Row Level Security audit against the live Supabase project.
 *
 *   npx tsx scripts/rls-audit.mts
 *
 * Creates two throwaway users — a victim with one row in every user-owned
 * table, and an attacker — then probes every table in the public schema as
 * (a) anon and (b) the attacker: read, insert-as-victim, update, delete.
 * Also probes the private progress-photo bucket, fails if any exposed table is
 * missing from the audit, and checks "server-only" tables that a user must not write even for
 * themselves (ai_usage, achievements, reminder_log, signup_attempts).
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY (read from .env.local). Exits 1 on any failure.
 * Everything it creates is deleted at the end, pass or fail.
 */
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { adminClient, createOnboardedUser, deleteTestUser, todayInKolkata } from '../e2e/support';

type Row = Record<string, unknown>;
type Verdict = { table: string; check: string; ok: boolean; detail: string };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = adminClient();
const anon = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
const results: Verdict[] = [];
const record = (table: string, check: string, ok: boolean, detail = '') => results.push({ table, check, ok, detail });

/** Tables every signed-in user owns rows in. Owner-only access expected. */
const OWNED = [
  'profiles', 'user_tasks', 'daily_logs', 'workout_sessions', 'workout_sets', 'food_entries', 'water_logs',
  'body_measurements', 'progress_photos', 'skin_logs', 'sleep_logs', 'gita_progress', 'content_posts',
  'checkins', 'ai_plans', 'push_subscriptions', 'reminder_settings', 'achievements', 'ai_usage', 'reminder_log',
] as const;

/** Users must not write these even for themselves: the server does. */
const SERVER_WRITTEN = ['achievements', 'ai_usage', 'reminder_log'] as const;

/**
 * ai_usage is the exception for inserts: recordUsage() writes it with the
 * user's own session after each AI call. An extra self-inserted row only
 * burns the user's own quota. Deleting rows (resetting the quota) must fail.
 */
const SELF_INSERT_ALLOWED = new Set<string>(['ai_usage']);

/** Shared reference data: anyone may read, nobody may write. */
const REFERENCE = ['exercises', 'task_templates'] as const;

async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

function ownerColumn(table: string): string {
  return table === 'profiles' ? 'id' : 'user_id';
}

/** One valid row per table for the victim, inserted with the service role. */
async function seedVictim(victimId: string): Promise<Record<string, Row>> {
  const today = todayInKolkata();
  const { data: task } = await admin.from('user_tasks').select('id').eq('user_id', victimId).limit(1).single();
  const { data: exercise } = await admin.from('exercises').select('id').limit(1).single();
  const insert = async (table: string, row: Row) => {
    const { data, error } = await admin.from(table).insert(row).select().single();
    if (error) throw new Error(`seed ${table}: ${error.message}`);
    return data as Row;
  };
  const session = await insert('workout_sessions', { user_id: victimId, session_date: today, finished_at: new Date().toISOString() });
  const rows: Record<string, Row> = {
    workout_sessions: session,
    daily_logs: await insert('daily_logs', { user_id: victimId, user_task_id: task!.id, log_date: today, completed: true }),
    workout_sets: await insert('workout_sets', { user_id: victimId, session_id: session.id, exercise_id: exercise!.id, set_no: 1, reps: 8, weight_kg: 40 }),
    food_entries: await insert('food_entries', { user_id: victimId, log_date: today, description: 'audit dal', calories: 400 }),
    water_logs: await insert('water_logs', { user_id: victimId, log_date: today }),
    progress_photos: await insert('progress_photos', { user_id: victimId, log_date: today, angle: 'front', storage_path: `${victimId}/${today}-front.jpg` }),
    skin_logs: await insert('skin_logs', { user_id: victimId, log_date: today }),
    sleep_logs: await insert('sleep_logs', { user_id: victimId, log_date: today }),
    gita_progress: await insert('gita_progress', { user_id: victimId, chapter: 1 }),
    content_posts: await insert('content_posts', { user_id: victimId, log_date: today }),
    checkins: await insert('checkins', { user_id: victimId, week: 1 }),
    ai_plans: await insert('ai_plans', { user_id: victimId, plan_type: 'workout', week: 1, content: { audit: true } }),
    push_subscriptions: await insert('push_subscriptions', {
      user_id: victimId,
      endpoint: `https://push.audit.invalid/${randomBytes(6).toString('hex')}`,
      p256dh: 'audit-p256dh-key-xxxxxxxx',
      auth: 'audit-auth-xxxx',
    }),
    reminder_settings: await insert('reminder_settings', { user_id: victimId, settings: {} }),
    achievements: await insert('achievements', { user_id: victimId, code: 'first_workout' }),
    ai_usage: await insert('ai_usage', { user_id: victimId, route: 'audit' }),
    reminder_log: await insert('reminder_log', { user_id: victimId, kind: 'audit', local_date: today }),
  };
  const { data: profile } = await admin.from('profiles').select('*').eq('id', victimId).single();
  const { data: bm } = await admin.from('body_measurements').select('*').eq('user_id', victimId).limit(1).single();
  rows.profiles = profile as Row;
  rows.user_tasks = (await admin.from('user_tasks').select('*').eq('id', task!.id).single()).data as Row;
  rows.body_measurements = bm as Row;
  return rows;
}

/** Strip generated columns so the row can be re-inserted as a probe. */
function probeRow(table: string, row: Row): Row {
  const copy: Row = { ...row };
  for (const key of ['id', 'created_at', 'sent_at', 'updated_at', 'body_fat_pct']) {
    if (table !== 'profiles' || key !== 'id') delete copy[key];
  }
  if (table === 'push_subscriptions') copy.endpoint = `https://push.audit.invalid/${randomBytes(6).toString('hex')}`;
  if (table === 'achievements') copy.code = 'ten_prs';
  if (table === 'reminder_log' || table === 'ai_usage') copy[table === 'ai_usage' ? 'route' : 'kind'] = 'audit-probe';
  if (table === 'gita_progress') copy.chapter = 2;
  if (table === 'checkins') copy.week = 2;
  if (table === 'ai_plans') copy.week = 2;
  return copy;
}

async function victimRowStillIntact(table: string, row: Row): Promise<boolean> {
  const key = table === 'profiles' ? 'id' : row.id !== undefined ? 'id' : ownerColumn(table);
  const { data } = await admin.from(table).select('*').eq(key, row[key] as string).limit(1);
  return Boolean(data && data.length === 1);
}

async function auditOwned(table: string, row: Row, victimId: string, attacker: SupabaseClient) {
  const owner = ownerColumn(table);
  for (const [who, client] of [['anon', anon], ['attacker', attacker]] as const) {
    // Read
    const read = await client.from(table).select('*').eq(owner, victimId);
    const leaked = (read.data ?? []).length;
    record(table, `${who} cannot read victim rows`, leaked === 0, read.error ? read.error.code ?? '' : `${leaked} rows`);

    // Insert as victim
    const ins = await client.from(table).insert(probeRow(table, row)).select();
    const inserted = !ins.error && (ins.data ?? []).length > 0;
    if (inserted) await admin.from(table).delete().match(probeRow(table, row));
    record(table, `${who} cannot insert as victim`, !inserted, ins.error?.code ?? (inserted ? 'INSERTED' : 'no rows'));

    // Update victim rows
    const patchCol = table === 'profiles' ? 'display_name' : owner;
    const patchVal = table === 'profiles' ? 'pwned' : victimId;
    const upd = await client.from(table).update({ [patchCol]: patchVal }).eq(owner, victimId).select();
    const updated = !upd.error && (upd.data ?? []).length > 0;
    record(table, `${who} cannot update victim rows`, !updated, upd.error?.code ?? `${(upd.data ?? []).length} rows`);

    // Delete victim rows
    await client.from(table).delete().eq(owner, victimId);
    const intact = await victimRowStillIntact(table, row);
    record(table, `${who} cannot delete victim rows`, intact, intact ? 'row intact' : 'ROW GONE');
  }
}

async function auditServerWritten(table: string, self: SupabaseClient, selfId: string) {
  const today = todayInKolkata();
  const row: Row =
    table === 'achievements' ? { user_id: selfId, code: 'streak_90' }
      : table === 'ai_usage' ? { user_id: selfId, route: 'ai/meal-estimate' }
        : { user_id: selfId, kind: 'wake', local_date: today };
  const ins = await self.from(table).insert(row).select();
  const inserted = !ins.error && (ins.data ?? []).length > 0;
  if (inserted) await admin.from(table).delete().match(row);
  if (SELF_INSERT_ALLOWED.has(table)) {
    record(table, 'user may insert own usage rows (only burns own quota)', true, inserted ? 'allowed' : ins.error?.code ?? '');
  } else {
    record(table, 'user cannot insert own rows (server-written)', !inserted, ins.error?.code ?? (inserted ? 'INSERTED' : 'no rows'));
  }

  // Seed one of their own, then try to delete it (e.g. resetting AI quota).
  const { data: seeded } = await admin.from(table).insert({ ...row, ...(table === 'achievements' ? { code: 'perfect_week' } : {}) }).select().single();
  await self.from(table).delete().eq('user_id', selfId);
  const { data: still } = await admin.from(table).select('*').eq('user_id', selfId);
  const survived = (still ?? []).length > 0;
  record(table, 'user cannot delete own rows (server-written)', survived, survived ? 'row intact' : 'DELETED');
  if (seeded) await admin.from(table).delete().eq('user_id', selfId);
}

async function auditReference(table: string, attacker: SupabaseClient) {
  const read = await anon.from(table).select('*').limit(1);
  record(table, 'anon can read reference data', !read.error && (read.data ?? []).length > 0, read.error?.code ?? '');
  for (const [who, client] of [['anon', anon], ['attacker', attacker]] as const) {
    const { data: before } = await admin.from(table).select('*').limit(1).single();
    const pk = before!.id as number;
    const upd = await client.from(table).update({ slug: (before!.slug as string) + '-x' }).eq('id', pk).select();
    const updated = !upd.error && (upd.data ?? []).length > 0;
    if (updated) await admin.from(table).update({ slug: before!.slug }).eq('id', pk);
    record(table, `${who} cannot modify reference data`, !updated, upd.error?.code ?? `${(upd.data ?? []).length} rows`);
    await client.from(table).delete().eq('id', pk);
    const { data: after } = await admin.from(table).select('id').eq('id', pk);
    record(table, `${who} cannot delete reference data`, (after ?? []).length === 1, (after ?? []).length === 1 ? 'intact' : 'DELETED');
  }
}

async function auditSignupAttempts(attacker: SupabaseClient) {
  for (const [who, client] of [['anon', anon], ['attacker', attacker]] as const) {
    const read = await client.from('signup_attempts').select('*').limit(1);
    record('signup_attempts', `${who} cannot read`, (read.data ?? []).length === 0, read.error?.code ?? '0 rows');
    const ins = await client.from('signup_attempts').insert({ ip_hash: 'audit' }).select();
    const inserted = !ins.error && (ins.data ?? []).length > 0;
    if (inserted) await admin.from('signup_attempts').delete().eq('ip_hash', 'audit');
    record('signup_attempts', `${who} cannot insert`, !inserted, ins.error?.code ?? '');
  }
}

async function auditPublicProfiles(victimUsername: string, privateUsername: string) {
  const { data } = await anon.from('public_profiles').select('*').eq('username', victimUsername);
  const cols = Object.keys(data?.[0] ?? {}).sort().join(',');
  record('public_profiles', 'exposes only id,username,display_name,avatar_url,challenge_start',
    cols === 'avatar_url,challenge_start,display_name,id,username', cols || 'no row');
  const { data: hidden } = await anon.from('public_profiles').select('id').eq('username', privateUsername);
  record('public_profiles', 'private users are not listed', (hidden ?? []).length === 0, `${(hidden ?? []).length} rows`);
}

/** Legacy JWT keys go in both headers; new sb_secret_ keys only in apikey. */
function restHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_') ? { apikey: key } : { apikey: key, Authorization: `Bearer ${key}` };
}

/** Every relation PostgREST exposes must be covered above, or the audit fails. */
async function auditCoverage(covered: Set<string>) {
  const res = await fetch(`${URL}/rest/v1/`, {
    headers: restHeaders(process.env.SUPABASE_SERVICE_ROLE_KEY!),
  });
  const spec = (await res.json()) as { definitions?: Record<string, unknown> };
  const live = Object.keys(spec.definitions ?? {});
  const missing = live.filter((t) => !covered.has(t));
  record('(coverage)', `every exposed relation is audited (${live.length} live)`, live.length > 0 && missing.length === 0,
    missing.length ? `NOT AUDITED: ${missing.join(', ')}` : 'all covered');
}

/**
 * Private photo bucket: a file under {victim}/ must be unreadable, unlistable
 * and unwritable for anon and for another user. The owner can read their own.
 */
async function auditStorage(victimId: string, victim: SupabaseClient, attacker: SupabaseClient) {
  const bucket = 'progress';
  const path = `${victimId}/2000-01-01-front.jpg`;
  const body = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  const seeded = await admin.storage.from(bucket).upload(path, body, { upsert: true, contentType: 'image/jpeg' });
  if (seeded.error) throw new Error(`seed storage: ${seeded.error.message}`);
  try {
    const own = await victim.storage.from(bucket).createSignedUrl(path, 60);
    record('storage:progress', 'owner can sign own photo', !own.error && Boolean(own.data?.signedUrl), own.error?.message ?? '');

    const publicUrl = admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    const pub = await fetch(publicUrl);
    record('storage:progress', 'bucket is not public', !pub.ok, `HTTP ${pub.status}`);

    for (const [who, client] of [['anon', anon], ['attacker', attacker]] as const) {
      const dl = await client.storage.from(bucket).download(path);
      record('storage:progress', `${who} cannot download victim photo`, Boolean(dl.error), dl.error ? 'denied' : 'DOWNLOADED');
      const signed = await client.storage.from(bucket).createSignedUrl(path, 60);
      record('storage:progress', `${who} cannot sign victim photo`, Boolean(signed.error) || !signed.data?.signedUrl, signed.error ? 'denied' : 'SIGNED');
      const list = await client.storage.from(bucket).list(victimId);
      const listed = (list.data ?? []).length;
      record('storage:progress', `${who} cannot list victim folder`, listed === 0, `${listed} files`);
      const up = await client.storage.from(bucket).upload(`${victimId}/2000-01-02-${who}.jpg`, body, { contentType: 'image/jpeg' });
      record('storage:progress', `${who} cannot upload into victim folder`, Boolean(up.error), up.error ? 'denied' : 'UPLOADED');
      const rm = await client.storage.from(bucket).remove([path]);
      const { data: still } = await admin.storage.from(bucket).list(victimId);
      const intact = (still ?? []).some((o) => o.name === '2000-01-01-front.jpg');
      record('storage:progress', `${who} cannot delete victim photo`, intact, intact ? 'intact' : `DELETED ${rm.error?.message ?? ''}`);
    }
  } finally {
    const { data: left } = await admin.storage.from(bucket).list(victimId);
    if (left?.length) await admin.storage.from(bucket).remove(left.map((o) => `${victimId}/${o.name}`));
  }
}

const victim = await createOnboardedUser(admin, 'rlsvictim');
const attackerUser = await createOnboardedUser(admin, 'rlsattacker', { isPublic: false });
try {
  const rows = await seedVictim(victim.id);
  const attacker = await signedIn(attackerUser.email, attackerUser.password);

  for (const table of OWNED) await auditOwned(table, rows[table]!, victim.id, attacker);
  for (const table of SERVER_WRITTEN) await auditServerWritten(table, attacker, attackerUser.id);
  for (const table of REFERENCE) await auditReference(table, attacker);
  await auditSignupAttempts(attacker);
  await auditPublicProfiles(victim.username, attackerUser.username);
  await auditStorage(victim.id, await signedIn(victim.email, victim.password), attacker);
  await auditCoverage(new Set<string>([...OWNED, ...REFERENCE, 'signup_attempts', 'public_profiles']));
} finally {
  await deleteTestUser(admin, victim);
  await deleteTestUser(admin, attackerUser);
}

const failed = results.filter((r) => !r.ok);
const tables = [...new Set(results.map((r) => r.table))];
console.log(`RLS audit: ${results.length} checks over ${tables.length} tables/views — ${failed.length} failed\n`);
for (const table of tables) {
  const mine = results.filter((r) => r.table === table);
  const bad = mine.filter((r) => !r.ok);
  console.log(`${bad.length ? 'FAIL' : 'ok  '}  ${table.padEnd(20)} ${mine.length - bad.length}/${mine.length}`);
  for (const r of bad) console.log(`        ✗ ${r.check} (${r.detail})`);
}
process.exit(failed.length ? 1 : 0);
