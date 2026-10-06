'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthError } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-redirect';
import { AUTH_ERRORS, HONEYPOT_FIELD, mapAuthError, signInSchema, signUpSchema } from '@/lib/auth/messages';
import { clientIp, hashIp, overLimit, windowStart } from '@/lib/auth/rate-limit';

/**
 * Email + password auth. Email confirmation is off in Supabase, so signUp
 * returns a session immediately: no "check your email" step anywhere.
 */

export interface AuthActionState {
  error?: string;
  /** Field-level messages keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** Echoed back so a failed submit does not clear what was typed (never the password). */
  values?: { name?: string; email?: string };
}

function logAuthError(op: string, error: AuthError): void {
  console.error(`[auth] ${op} failed`, {
    message: error.message,
    status: error.status,
    code: error.code,
    name: error.name,
  });
}

function firstIssues(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

async function destinationAfterSignIn(next: string | undefined): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return '/login';
  const { data: profile } = await supabase.from('profiles').select('onboarded').eq('id', user.id).maybeSingle();
  return profile?.onboarded ? safeNext(next, '/today') : '/onboarding';
}

export async function signIn(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const raw = Object.fromEntries(formData);
  const email = String(raw.email ?? '');
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: firstIssues(parsed.error.issues), values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logAuthError('signInWithPassword', error);
    return { error: mapAuthError(error.code, 'signIn'), values: { email } };
  }

  redirect(await destinationAfterSignIn(parsed.data.next));
}

export async function signUp(_prev: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const raw = Object.fromEntries(formData);
  const values = { name: String(raw.name ?? ''), email: String(raw.email ?? '') };

  // Honeypot: bots fill every field. Say nothing useful.
  if (String(raw[HONEYPOT_FIELD] ?? '').trim() !== '') {
    console.warn('[auth] signUp honeypot tripped');
    return { error: AUTH_ERRORS.generic, values };
  }

  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: firstIssues(parsed.error.issues), values };
  }

  // Abuse guard: at most 5 signups per IP per hour, counted in the database
  // because serverless instances share no memory.
  const service = createServiceClient();
  const secret = process.env.SIGNUP_IP_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ipHash = hashIp(clientIp(await headers()), secret);

  const { count, error: countError } = await service
    .from('signup_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', windowStart());
  if (countError) {
    console.error('[auth] signup rate check failed', countError.message);
    return { error: AUTH_ERRORS.generic, values };
  }
  if (overLimit(count ?? 0)) {
    return { error: AUTH_ERRORS.tooManySignups, values };
  }
  await service.from('signup_attempts').insert({ ip_hash: ipHash });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    // The signup trigger reads full_name for profiles.display_name.
    options: { data: { full_name: parsed.data.name, display_name: parsed.data.name } },
  });

  if (error) {
    logAuthError('signUp', error);
    const message = mapAuthError(error.code, 'signUp');
    return message === AUTH_ERRORS.emailTaken
      ? { fieldErrors: { email: message }, values }
      : message === AUTH_ERRORS.passwordTooShort
        ? { fieldErrors: { password: message }, values }
        : { error: message, values };
  }

  if (!data.session || !data.user) {
    // Only possible if email confirmation is switched back on in Supabase.
    console.error('[auth] signUp returned no session — is "Confirm email" enabled?');
    return { error: AUTH_ERRORS.generic, values };
  }

  // Belt and braces: the trigger already copied full_name, but make sure.
  await supabase.from('profiles').update({ display_name: parsed.data.name }).eq('id', data.user.id);

  redirect('/onboarding');
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get('next')?.toString());
  const supabase = await createClient();
  const h = await headers();
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('x-forwarded-host') ?? h.get('host')}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });

  if (error || !data.url) {
    if (error) logAuthError('signInWithOAuth', error);
    redirect(`/login?error=${encodeURIComponent('Google sign-in is unavailable.')}`);
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
