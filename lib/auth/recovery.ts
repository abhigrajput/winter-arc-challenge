/**
 * Forgot-password helpers. Pure, so they are unit tested.
 *
 * The reset email signs the user in with a session whose `amr` claim records
 * a `recovery` (or OTP) authentication. /auth/reset only accepts sessions
 * like that, and only while fresh: any other signed-in session must go
 * through Settings → Change password, which re-checks the current password.
 */

/** How long after following the email link the new password may be set. */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;

/** FORGOT_PASSWORD_ENABLED: only the exact strings "true" or "1" turn it on. */
export function parseFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

/** Server-only: is the forgot-password flow switched on? */
export function passwordResetEnabled(): boolean {
  return parseFlag(process.env.FORGOT_PASSWORD_ENABLED);
}

type AmrClaim = ReadonlyArray<{ method: string; timestamp: number } | string> | undefined;

/** Methods Supabase records for a session created from a recovery email link. */
const RECOVERY_METHODS = new Set(['recovery', 'otp']);

/**
 * True when the session was established by a recovery link within the
 * window. String-form AMR entries carry no timestamp, so they never pass.
 */
export function isRecentRecovery(amr: AmrClaim, nowSeconds: number, windowSeconds = RECOVERY_WINDOW_SECONDS): boolean {
  if (!amr) return false;
  return amr.some(
    (entry) =>
      typeof entry !== 'string' &&
      RECOVERY_METHODS.has(entry.method) &&
      entry.timestamp <= nowSeconds + 60 &&
      nowSeconds - entry.timestamp <= windowSeconds,
  );
}

/** isRecentRecovery against the current clock (server pages and actions). */
export function isRecoverySessionNow(amr: AmrClaim): boolean {
  return isRecentRecovery(amr, Math.floor(Date.now() / 1000));
}
