import 'server-only';
import webpush, { WebPushError } from 'web-push';
import type { PushPayload } from '@/lib/reminders/messages';
import { classifyPushStatus, type PushOutcome } from '@/lib/push/outcome';

/**
 * Web Push sender (§8.13). VAPID keys come from env; the private key never
 * leaves the server. A dead subscription (404/410 from the push service) is
 * reported as "gone" so the caller deletes it.
 */

let configured = false;

export class PushNotConfiguredError extends Error {
  constructor() {
    super('Push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
    this.name = 'PushNotConfiguredError';
  }
}

function configure(): void {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) throw new PushNotConfiguredError();
  // The subject lets push services contact the sender; a site URL is allowed.
  const subject = process.env.VAPID_SUBJECT || 'https://winter-arc-challenge-blue.vercel.app';
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface StoredSubscription {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPush(sub: StoredSubscription, payload: PushPayload): Promise<PushOutcome> {
  configure();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      // Reminders are only useful near their time; let the push service drop stale ones.
      { TTL: 60 * 30, urgency: 'normal', timeout: 10_000 },
    );
    return 'sent';
  } catch (error) {
    if (error instanceof WebPushError) return classifyPushStatus(error.statusCode);
    return 'error';
  }
}
