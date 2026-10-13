/**
 * Auth features that depend on infrastructure not set up yet.
 *
 * - google: needs the Google provider enabled in Supabase Auth and the OAuth
 *   client configured (CLAUDE.md §14). Currently disabled in the project.
 *
 * Forgot password is switched by the FORGOT_PASSWORD_ENABLED env var instead
 * (lib/auth/recovery.ts), read on the server and passed down as a prop.
 */
export const AUTH_FEATURES = {
  google: false,
} as const;
