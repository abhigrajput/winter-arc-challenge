import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/lib/supabase/types';

export interface SessionProfile {
  userId: string;
  email: string | null;
  profile: ProfileRow | null;
}

/**
 * Loads the signed-in user and their profile row.
 * Redirects to /login when there is no session — proxy.ts normally catches this
 * first, so reaching the redirect means the session died mid-request.
 *
 * profile is null only in the window between signup and the handle_new_user
 * trigger landing the stub row.
 */
export async function requireUser(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { userId: user.id, email: user.email ?? null, profile: profile ?? null };
}
