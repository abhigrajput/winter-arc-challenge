import { z } from 'zod';

/**
 * Plain-text auth errors. Supabase's own messages ("Invalid login credentials",
 * "User already registered") are mapped to these, never shown raw.
 */
export const AUTH_ERRORS = {
  emailTaken: 'Email already registered',
  wrongCredentials: 'Wrong email or password',
  passwordTooShort: 'Password too short',
  passwordMismatch: 'Passwords do not match',
  invalidEmail: 'Enter a valid email',
  nameRequired: 'Enter your name',
  tooManySignups: 'Too many accounts from this network. Try again in an hour.',
  generic: 'Something went wrong. Try again.',
} as const;

export const MIN_PASSWORD = 8;

/** Name of the hidden honeypot input on the signup form. Real users never fill it. */
export const HONEYPOT_FIELD = 'company';

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(AUTH_ERRORS.invalidEmail),
  password: z.string().min(1, AUTH_ERRORS.wrongCredentials),
  next: z.string().optional(),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, AUTH_ERRORS.nameRequired).max(40, 'Keep the name under 40 characters'),
    email: z.string().trim().toLowerCase().email(AUTH_ERRORS.invalidEmail),
    password: z.string().min(MIN_PASSWORD, AUTH_ERRORS.passwordTooShort).max(72, 'Password too long'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: AUTH_ERRORS.passwordMismatch });

/** Supabase AuthError code → our message. */
export function mapAuthError(code: string | undefined, fallback: 'signIn' | 'signUp'): string {
  switch (code) {
    case 'user_already_exists':
    case 'email_exists':
      return AUTH_ERRORS.emailTaken;
    case 'invalid_credentials':
      return AUTH_ERRORS.wrongCredentials;
    case 'weak_password':
      return AUTH_ERRORS.passwordTooShort;
    case 'email_address_invalid':
      return AUTH_ERRORS.invalidEmail;
    default:
      return fallback === 'signIn' ? AUTH_ERRORS.wrongCredentials : AUTH_ERRORS.generic;
  }
}
