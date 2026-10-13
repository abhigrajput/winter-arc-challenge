'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site';
import { AUTH_ERRORS, mapAuthError, newPasswordSchema, resetRequestSchema } from '@/lib/auth/messages';
import { isRecoverySessionNow, passwordResetEnabled } from '@/lib/auth/recovery';

export interface ResetState {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** Request step: the neutral "check your email" message is showing. */
  sent?: boolean;
  email?: string;
}

const DISABLED = 'Password reset is not available.';

/** Where the email link lands: the auth callback, then the new-password form. */
async function resetRedirect(): Promise<string> {
  const origin = (await headers()).get('origin');
  const base = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : SITE_URL;
  return `${base}/auth/callback?next=/auth/reset`;
}

/**
 * Step 1: send the reset email. Always answers the same way, whether or not
 * an account exists, so the form cannot be used to discover accounts.
 * Supabase rate-limits recovery emails per address and per project.
 */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!passwordResetEnabled()) return { error: DISABLED };

  const email = String(formData.get('email') ?? '');
  const parsed = resetRequestSchema.safeParse({ email });
  if (!parsed.success) return { fieldErrors: { email: AUTH_ERRORS.invalidEmail }, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: await resetRedirect() });
  if (error) {
    // Logged, never shown: a "user not found" or rate-limit error must look
    // the same as success from the outside.
    console.error('[auth] resetPasswordForEmail failed', { code: error.code, status: error.status, message: error.message });
  }
  return { sent: true, email: parsed.data.email };
}

/** Step 2: set the new password. Only for a fresh recovery session. */
export async function setNewPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  if (!passwordResetEnabled()) return { error: DISABLED };

  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data || !isRecoverySessionNow(data.claims.amr)) {
    return { error: 'This reset link has expired. Request a new one.' };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error('[auth] updateUser (reset) failed', { code: error.code, message: error.message });
    return {
      error: error.code === 'same_password' ? 'New password must be different' : mapAuthError(error.code, 'signUp'),
    };
  }

  // Whoever had the old password is signed out everywhere else.
  await supabase.auth.signOut({ scope: 'others' });

  const { data: profile } = await supabase.from('profiles').select('onboarded').eq('id', data.claims.sub).maybeSingle();
  redirect(profile?.onboarded ? '/today' : '/onboarding');
}
