/**
 * Auth features that depend on infrastructure not set up yet.
 *
 * - passwordReset: needs SMTP (reset emails). Off until a mail provider is
 *   configured in Supabase; the link is hidden, nothing else changes.
 * - google: needs the Google provider enabled in Supabase Auth and the OAuth
 *   client configured (CLAUDE.md §14). Currently disabled in the project.
 */
export const AUTH_FEATURES = {
  passwordReset: false,
  google: false,
} as const;
