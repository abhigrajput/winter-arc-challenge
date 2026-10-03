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
