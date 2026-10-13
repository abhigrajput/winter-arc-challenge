'use server';

import { redirect } from 'next/navigation';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { AUTH_ERRORS, MIN_PASSWORD } from '@/lib/auth/messages';
import { DELETE_CONFIRMATION, isDeleteConfirmed } from '@/lib/account/tables';
import { deleteAccount } from '@/lib/account/server';

export interface AccountState {
  error?: string;
  fieldErrors?: Record<string, string>;
  done?: boolean;
}

const passwordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password'),
    next: z.string().min(MIN_PASSWORD, AUTH_ERRORS.passwordTooShort).max(72, 'Password too long'),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ['confirm'], message: AUTH_ERRORS.passwordMismatch })
  .refine((v) => v.next !== v.current, { path: ['next'], message: 'New password must be different' });

/** Change password: the current one is re-checked first. */
export async function changePassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: 'Not signed in.' };

  // Verify the current password with a throwaway client, so the user's own
  // session cookies are never touched by the check.
  const probe = createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
  if (wrong) return { fieldErrors: { current: 'Current password is wrong' } };
  await probe.auth.signOut({ scope: 'local' });

  const { error } = await supabase.auth.updateUser({ password: parsed.data.next });
  if (error) {
    console.error('[account] updateUser failed', { code: error.code, message: error.message });
    return { error: error.code === 'weak_password' ? AUTH_ERRORS.passwordTooShort : AUTH_ERRORS.generic };
  }
  return { done: true };
}

/** Delete account: typed confirmation, then photos + every row, then sign out. */
export async function deleteMyAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  if (!isDeleteConfirmed(formData.get('confirm'))) {
    return { fieldErrors: { confirm: `Type ${DELETE_CONFIRMATION} to confirm` } };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  try {
    const report = await deleteAccount(user.id);
    console.info('[account] deleted', { photosRemoved: report.photosRemoved });
  } catch (error) {
    console.error('[account] delete failed', error instanceof Error ? error.message : error);
    return { error: 'Could not delete the account. Nothing was removed from your profile; try again.' };
  }

  // The user no longer exists; clear the now-dead session cookies.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
  redirect('/login?deleted=1');
}

/**
 * Public profile on/off. Private profiles disappear from the leaderboard and
 * /u/[username] (both read only public, onboarded profiles), and get_streak
 * returns 0 to everyone else.
 */
export async function setPublicProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const isPublic = formData.get('is_public') === 'on';
  const { error } = await supabase.from('profiles').update({ is_public: isPublic }).eq('id', user.id);
  if (error) return { error: 'Could not save. Try again.' };
  return { done: true };
}
