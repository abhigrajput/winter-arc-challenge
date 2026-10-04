import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/push/subscribe — stores this device's PushSubscription (§8.13).
 *
 * Keyed on endpoint (unique). If the same browser was previously subscribed
 * under another account, the row is handed over to the signed-in user: RLS
 * hides other users' rows, so that one reassignment uses the service client.
 */

export const dynamic = 'force-dynamic';

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://', 'Push endpoints are HTTPS.').max(2000),
  keys: z.object({
    p256dh: z.string().min(16).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const parsed = subscriptionSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 });
  }

  const row = {
    user_id: user.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get('user-agent')?.slice(0, 200) ?? null,
  };

  const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });

  if (error) {
    // Most likely the endpoint belongs to another account on this browser.
    const service = createServiceClient();
    await service.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
    const { error: retryError } = await supabase.from('push_subscriptions').insert(row);
    if (retryError) {
      console.error('[push/subscribe] failed', retryError.message);
      return NextResponse.json({ error: 'Could not save this device.' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
