/**
 * Debug: live AI routes end to end (real DeepSeek calls, uses quota and spend).
 * Needs a local server on :3100 (npx next start -p 3100). Creates a throwaway
 * user and deletes it at the end.
 *   npx tsx scripts/debug/live-ai-check.mts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!]=m[2]!.trim(); }
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ref = new URL(URL_).host.split('.')[0];
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pub = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const B = 'http://localhost:3100';
const email = `aitest+${Date.now()}@example.com`, password = 'Ai-test-pass-123!';
const u = await admin.auth.admin.createUser({ email, password, email_confirm: true });
const id = u.data.user!.id;
try {
  const up = await admin.from('profiles').update({
    username: `aitest${Date.now() % 1e8}`, display_name: 'AI Test', sex: 'male', age: 24, height_cm: 175, weight_kg: 74,
    target_weight_kg: 68, activity_level: 1.55, goal: 'fat_loss', modules: ['abs'], training_mode: 'gym',
    equipment: ['dumbbells', 'bench', 'barbell', 'pullup_bar'], max_dumbbell_kg: 25, fitness_level: 'intermediate',
    days_per_week: 4, session_minutes: 60, diet_type: 'egg', budget: 'hostel', calorie_target: 2200,
    protein_target_g: 150, carbs_target_g: 240, fat_target_g: 65, water_target_ml: 2600, timezone: 'Asia/Kolkata',
    onboarded: true,
  }).eq('id', id);
  if (up.error) throw up.error;
  const s = await pub.auth.signInWithPassword({ email, password });
  if (s.error) throw s.error;
  const val = 'base64-' + Buffer.from(JSON.stringify(s.data.session)).toString('base64url');
  const name = `sb-${ref}-auth-token`;
  const chunks = val.match(/.{1,3180}/g)!;
  const cookie = chunks.length === 1 ? `${name}=${val}` : chunks.map((c, i) => `${name}.${i}=${c}`).join('; ');

  const call = async (path: string, body: unknown) => {
    const t = Date.now();
    const r = await fetch(B + path, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => null) as Record<string, unknown> | null;
    const ms = Date.now() - t;
    const summary = j ? { source: j.source, error: j.error, reason: j.reason, violations: j.violations, rejections: j.rejections,
      keys: Object.keys((j.plan ?? j.estimate ?? j.feedback ?? {}) as object) } : null;
    console.log(`${path} → ${r.status} in ${ms} ms`, JSON.stringify(summary));
    if (path.includes('meal') && j?.estimate) console.log('  estimate:', JSON.stringify(j.estimate).slice(0, 400));
    if (path.includes('checkin') && j?.feedback) console.log('  verdict:', String((j.feedback as {verdict?: string}).verdict).slice(0, 200));
  };
  await call('/api/ai/meal-estimate', { description: '2 roti, dal, paneer 100g' });
  await call('/api/ai/plan', { type: 'workout', week: 1 });
  await call('/api/ai/checkin', { energy: 4, hunger: 3, notes: 'Felt good, missed one session.', painNotes: '' });
} finally {
  const del = await admin.auth.admin.deleteUser(id);
  const left = await admin.from('profiles').select('id').eq('id', id);
  const usage = await admin.from('ai_usage').select('id').eq('user_id', id);
  console.log('cleanup: user deleted', !del.error, '| profile rows left', left.data?.length, '| ai_usage rows left', usage.data?.length);
}
