import { STREAK_THRESHOLD } from '@/lib/calc/streak';
import type { DayContext, DueReminder } from '@/lib/reminders/due';

/**
 * Notification copy. Cold, short, factual — no shame, no "earn your food" (§10).
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Same-origin path opened on click. */
  url: string;
  /** Replaces an earlier notification of the same kind instead of stacking. */
  tag: string;
}

export function reminderPayload(
  reminder: DueReminder,
  day: DayContext | null,
  challengeDay: number,
): PushPayload {
  const tag = `wa-${reminder.kind}`;
  switch (reminder.kind) {
    case 'wake':
      return {
        title: 'Wake up',
        body: challengeDay > 0 ? `Day ${challengeDay} of 90. Log it.` : 'Up. Log it on Today.',
        url: '/today',
        tag,
      };
    case 'workout':
      return { title: 'Workout', body: 'Session due. Open the logger.', url: '/train', tag };
    case 'water':
      return { title: 'Water', body: 'One glass now. Log it.', url: '/nutrition', tag };
    case 'skincare_pm':
      return { title: 'Skincare PM', body: 'Cleanse, moisturise, done.', url: '/face', tag };
    case 'wind_down':
      return { title: 'Wind down', body: 'Screens off. Bed in 30 minutes.', url: '/today', tag };
    case 'streak_risk': {
      const completed = day?.completed ?? 0;
      const active = day?.active ?? 0;
      const needed = Math.max(0, Math.ceil(active * STREAK_THRESHOLD) - completed);
      return {
        title: 'Streak at risk',
        body: `${completed}/${active} done. ${needed} more keeps the streak.`,
        url: '/today',
        tag,
      };
    }
  }
}

export const TEST_PAYLOAD: PushPayload = {
  title: 'Winter Arc',
  body: 'Test push. Reminders are working.',
  url: '/settings',
  tag: 'wa-test',
};
