import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { challengeDayOn } from '@/lib/calc/day';
import { summariseDays } from '@/lib/calc/streak';
import {
  candidateReminders,
  filterByProgress,
  localClock,
  needsProgress,
  type DayContext,
} from '@/lib/reminders/due';
import { parseReminderSettings } from '@/lib/reminders/settings';
import { reminderPayload } from '@/lib/reminders/messages';
import { sendPush, type StoredSubscription } from '@/lib/push/send';

/**
 * POST /api/cron/reminders — §8.13.
 *
 * Called every 15 minutes by Supabase pg_cron + pg_net (see
 * supabase/migrations/phase-14.sql) with `Authorization: Bearer CRON_SECRET`.
 * Vercel Hobby crons run at most daily, so vercel.json is not used.
 *
 * For every user with a push subscription: work out their local time from
 * profiles.timezone, find reminders due in the current 15-minute window, claim
 * each one in reminder_log (unique per user, key, local date — the dedupe), and
 * push it to each of their devices. Subscriptions the push service reports as
 * gone (404/410) are deleted.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type Service = ReturnType<typeof createServiceClient>;

interface Summary {
  ok: true;
  at: string;
  users: number;
  due: number;
  sent: number;
  duplicates: number;
  removed: number;
  failed: number;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const service = createServiceClient();
  const now = new Date();
  const summary: Summary = {
    ok: true,
    at: now.toISOString(),
    users: 0,
    due: 0,
    sent: 0,
    duplicates: 0,
    removed: 0,
    failed: 0,
  };

  const { data: subs, error: subsError } = await service
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth');
  if (subsError) {
    console.error('[cron/reminders] could not read subscriptions', subsError.message);
    return NextResponse.json({ error: 'Could not read subscriptions.' }, { status: 500 });
  }

  const byUser = new Map<string, StoredSubscription[]>();
  for (const sub of subs ?? []) {
    const list = byUser.get(sub.user_id) ?? [];
    list.push(sub);
    byUser.set(sub.user_id, list);
  }
  if (byUser.size === 0) return NextResponse.json(summary);

  const userIds = [...byUser.keys()];
  const [{ data: profiles }, { data: settingsRows }, { data: templates }] = await Promise.all([
    service
      .from('profiles')
      .select('id, timezone, wake_time, sleep_target_h, modules, challenge_start, onboarded')
      .in('id', userIds),
    service.from('reminder_settings').select('user_id, settings').in('user_id', userIds),
    service.from('task_templates').select('id, slug'),
  ]);

  const settingsByUser = new Map((settingsRows ?? []).map((row) => [row.user_id, row.settings]));
  const slugById = new Map((templates ?? []).map((t) => [t.id, t.slug]));

  for (const profile of profiles ?? []) {
    if (!profile.onboarded) continue;
    summary.users += 1;

    const settings = parseReminderSettings(settingsByUser.get(profile.id), profile);
    const clock = localClock(now, profile.timezone);
    const candidates = candidateReminders(settings, clock);
    if (candidates.length === 0) continue;

    const day = needsProgress(candidates)
      ? await loadDay(service, profile.id, clock.date, slugById)
      : null;
    const due = day ? filterByProgress(candidates, day) : candidates;
    summary.due += due.length;

    const userSubs = byUser.get(profile.id) ?? [];
    const dayNumber = challengeDayOn(profile.challenge_start, clock.date);

    for (const reminder of due) {
      // Claim first: only the run that inserts the row sends the push.
      const { data: claimed, error: claimError } = await service
        .from('reminder_log')
        .upsert(
          { user_id: profile.id, kind: reminder.key, local_date: reminder.localDate },
          { onConflict: 'user_id,kind,local_date', ignoreDuplicates: true },
        )
        .select('kind');
      if (claimError) {
        console.error('[cron/reminders] claim failed', claimError.message);
        summary.failed += 1;
        continue;
      }
      if (!claimed || claimed.length === 0) {
        summary.duplicates += 1;
        continue;
      }

      const payload = reminderPayload(reminder, day, dayNumber);
      const outcomes = await Promise.all(
        userSubs.map(async (sub) => ({ sub, outcome: await sendPush(sub, payload) })),
      );

      for (const { sub, outcome } of outcomes) {
        if (outcome === 'sent') {
          summary.sent += 1;
          await service
            .from('push_subscriptions')
            .update({ last_success_at: new Date().toISOString() })
            .eq('id', sub.id);
        } else if (outcome === 'gone') {
          summary.removed += 1;
          await service.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          summary.failed += 1;
        }
      }
    }
  }

  console.info('[cron/reminders]', summary);
  return NextResponse.json(summary);
}

/** Today's progress for one user, counted exactly like the Today page. */
async function loadDay(
  service: Service,
  userId: string,
  date: string,
  slugById: Map<number, string>,
): Promise<DayContext> {
  const [{ data: logs }, { data: tasks }] = await Promise.all([
    service
      .from('daily_logs')
      .select('log_date, completed, user_task_id')
      .eq('user_id', userId)
      .eq('log_date', date),
    service.from('user_tasks').select('id, active, template_id').eq('user_id', userId),
  ]);

  const taskById = new Map((tasks ?? []).map((t) => [t.id, t]));
  const rows = (logs ?? []).map((log) => ({
    log_date: log.log_date,
    completed: log.completed,
    active: taskById.get(log.user_task_id)?.active ?? false,
  }));
  const summary = summariseDays(rows, date)[0] ?? { date, completed: 0, active: 0 };

  const doneSlugs = new Set<string>();
  for (const log of logs ?? []) {
    const task = taskById.get(log.user_task_id);
    if (!log.completed || !task?.active || task.template_id == null) continue;
    const slug = slugById.get(task.template_id);
    if (slug) doneSlugs.add(slug);
  }

  return { completed: summary.completed, active: summary.active, doneSlugs };
}

export const POST = handle;
export const GET = handle;
