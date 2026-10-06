import { createHmac } from 'node:crypto';

/**
 * Signup abuse guard: at most SIGNUP_LIMIT signups per IP per window.
 * Pure helpers here; the action does the database count (signup_attempts).
 */

export const SIGNUP_LIMIT = 5;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

/**
 * The client IP as Vercel reports it. x-forwarded-for can be a chain
 * ("client, proxy1, proxy2"); the first entry is the client.
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || headers.get('x-real-ip')?.trim() || 'unknown';
}

/** HMAC so the stored value cannot be reversed to an IP without the server secret. */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip).digest('hex');
}

export function windowStart(now: Date = new Date()): string {
  return new Date(now.getTime() - SIGNUP_WINDOW_MS).toISOString();
}

export function overLimit(attemptsInWindow: number): boolean {
  return attemptsInWindow >= SIGNUP_LIMIT;
}
