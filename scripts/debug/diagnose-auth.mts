/**
 * Auth diagnosis against the live Supabase project. Reads keys from .env.local.
 *   npx tsx scripts/debug/diagnose-auth.mts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
console.log('host:', new URL(url).host);

const admin = createClient(url, service, { auth: { persistSession: false } });
const pub = createClient(url, anon, { auth: { persistSession: false } });

const created: string[] = [];
const email = `test+${Date.now()}@example.com`;
const password = 'Diag-' + Math.random().toString(36).slice(2) + '!9';

try {
  console.log('\n[a] admin.createUser', email);
  const a = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (a.error) console.log('  ERROR', { message: a.error.message, status: a.error.status, code: a.error.code });
  else {
    created.push(a.data.user.id);
    console.log('  ok', a.data.user.id);
    const p = await admin.from('profiles').select('*').eq('id', a.data.user.id).maybeSingle();
    console.log('  profile row:', p.error ? p.error : p.data ? 'present' : 'MISSING');
    const t = await admin.from('user_tasks').select('id', { count: 'exact', head: true }).eq('user_id', a.data.user.id);
    console.log('  user_tasks:', t.error ? t.error : t.count);
  }

  console.log('\n[b] signInWithPassword');
  const b = await pub.auth.signInWithPassword({ email, password });
  if (b.error) console.log('  ERROR', { message: b.error.message, status: b.error.status, code: b.error.code });
  else console.log('  ok, session:', Boolean(b.data.session));

  console.log('\n[b2] public signUp (same path as the form)');
  const e2 = `test+${Date.now()}s@example.com`;
  const s = await pub.auth.signUp({ email: e2, password });
  if (s.error) console.log('  ERROR', { message: s.error.message, status: s.error.status, code: s.error.code });
  else {
    if (s.data.user) created.push(s.data.user.id);
    console.log('  ok, session:', Boolean(s.data.session), 'confirmed:', s.data.user?.email_confirmed_at ?? null);
  }

  console.log('\n[c] recent auth users');
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (list.error) console.log('  ERROR', list.error.message);
  else
    for (const u of list.data.users)
      console.log(`  ${u.email}  created=${u.created_at}  confirmed=${u.email_confirmed_at ?? 'NO'}  provider=${u.app_metadata.provider}`);
} finally {
  console.log('\n[d] cleanup');
  for (const id of created) {
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log('  delete', id, error ? error.message : 'ok');
  }
}
