import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Loads .env.local without overriding anything already set (CI secrets win). */
function loadEnv(): void {
  let contents = '';
  try {
    contents = readFileSync('.env.local', 'utf8');
  } catch {
    return;
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!.trim().replace(/^"(.*)"$/, '$1');
    }
  }
}

loadEnv();

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('e2e needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, { auth: { persistSession: false } });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
}

/** A confirmed, not-yet-onboarded user. Always pair with deleteTestUser. */
export async function createTestUser(admin: SupabaseClient, tag: string): Promise<TestUser> {
  const email = `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const password = `E2e-${Math.random().toString(36).slice(2)}-9!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser returned no user');
  return { id: data.user.id, email, password };
}

/** Deleting the auth user cascades to profiles, user_tasks and body_measurements. */
export async function deleteTestUser(admin: SupabaseClient, user: TestUser | undefined): Promise<void> {
  if (!user) return;
  await admin.auth.admin.deleteUser(user.id);
}

/** Body numbers seeded on every onboarded test user. Distinctive, so a leak is easy to spot. */
export const SEEDED_BODY = { weight_kg: 83.7, target_weight_kg: 76.3, height_cm: 177.2, waist_cm: 91.4, neck_cm: 39.6 };

/**
 * A user who has finished onboarding (written directly, not through the UI),
 * with a baseline measurement row. `isPublic` controls leaderboard visibility.
 */
export async function createOnboardedUser(
  admin: SupabaseClient,
  tag: string,
  { isPublic = true }: { isPublic?: boolean } = {},
): Promise<TestUser & { username: string }> {
  const user = await createTestUser(admin, tag);
  const username = `e2e${tag}${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 20);
  const { error } = await admin
    .from('profiles')
    .update({
      username,
      display_name: `E2E ${tag}`,
      sex: 'male',
      age: 27,
      height_cm: SEEDED_BODY.height_cm,
      weight_kg: SEEDED_BODY.weight_kg,
      target_weight_kg: SEEDED_BODY.target_weight_kg,
      activity_level: 1.55,
      goal: 'fat_loss',
      training_mode: 'home',
      fitness_level: 'beginner',
      days_per_week: 4,
      session_minutes: 45,
      diet_type: 'veg',
      budget: 'hostel',
      calorie_target: 2150,
      protein_target_g: 150,
      timezone: 'Asia/Kolkata',
      is_public: isPublic,
      onboarded: true,
    })
    .eq('id', user.id);
  if (error) throw error;

  const today = todayInKolkata();
  const { error: bmError } = await admin.from('body_measurements').insert({
    user_id: user.id,
    log_date: today,
    weight_kg: SEEDED_BODY.weight_kg,
    waist_cm: SEEDED_BODY.waist_cm,
    neck_cm: SEEDED_BODY.neck_cm,
  });
  if (bmError) throw bmError;

  return { ...user, username };
}

/** Marks every active task done today, so the user has points and a 1-day streak. */
export async function completeToday(admin: SupabaseClient, userId: string): Promise<number> {
  const { data: tasks, error } = await admin
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true);
  if (error) throw error;
  const today = todayInKolkata();
  const { error: insertError } = await admin
    .from('daily_logs')
    .insert((tasks ?? []).map((t) => ({ user_id: userId, user_task_id: t.id, log_date: today, completed: true })));
  if (insertError) throw insertError;
  return tasks?.length ?? 0;
}

export function todayInKolkata(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
