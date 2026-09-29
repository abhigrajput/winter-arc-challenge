import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/supabase/types';
import { publicEnv } from '@/lib/env';

/**
 * Supabase client for server components, server actions and route handlers.
 * Must be created per request — never cache it in a module-level variable.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a server component — middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Cron jobs only. Bypasses RLS. */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');

  return createServerClient<Database>(publicEnv.supabaseUrl, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
