/** Result of one push attempt. */
export type PushOutcome = 'sent' | 'gone' | 'error';

/**
 * 404 and 410 from a push service mean the subscription no longer exists
 * (uninstalled, permission revoked, expired). Those rows must be deleted.
 * Anything else — 429, 5xx, a 413 payload — is transient or our fault, and the
 * subscription is kept.
 */
export function classifyPushStatus(statusCode: number | undefined): PushOutcome {
  if (statusCode === 404 || statusCode === 410) return 'gone';
  if (statusCode !== undefined && statusCode >= 200 && statusCode < 300) return 'sent';
  return 'error';
}

/** The browser-side subscription JSON, as PushSubscription.toJSON() returns it. */
export interface SubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
