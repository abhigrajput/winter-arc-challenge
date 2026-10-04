import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendPush, PushNotConfiguredError } from '@/lib/push/send';
import { TEST_PAYLOAD } from '@/lib/reminders/messages';

/**
 * POST /api/push/test — sends one test notification to each of the signed-in
 * user's devices. At most once a minute: the claim reuses reminder_log
 * (key test_HHMM, UTC), which only the service role can write.
 */

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', user.id);
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'Turn on notifications on this device first.' }, { status: 409 });
  }

  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data: claimed } = await service
    .from('reminder_log')
    .upsert(
      { user_id: user.id, kind: `test_${now.slice(11, 13)}${now.slice(14, 16)}`, local_date: now.slice(0, 10) },
      { onConflict: 'user_id,kind,local_date', ignoreDuplicates: true },
    )
    .select('kind');
  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ error: 'One test a minute. Try again shortly.' }, { status: 429 });
  }

  try {
    let sent = 0;
    let removed = 0;
    for (const sub of subs) {
      const outcome = await sendPush(sub, TEST_PAYLOAD);
      if (outcome === 'sent') sent += 1;
      if (outcome === 'gone') {
        removed += 1;
        await service.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
    return NextResponse.json({ ok: sent > 0, sent, removed, devices: subs.length });
  } catch (error) {
    if (error instanceof PushNotConfiguredError) {
      return NextResponse.json({ error: 'Push is not configured on the server.' }, { status: 503 });
    }
    throw error;
  }
}
