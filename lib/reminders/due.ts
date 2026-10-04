import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import {
  STREAK_RISK_THRESHOLD,
  STREAK_RISK_TIME,
  TIMED_KINDS,
  WATER_SLOTS,
  toMinutes,
  type ReminderKind,
  type ReminderSettings,
} from '@/lib/reminders/settings';

/**
 * Which reminders are due for one user, right now (§8.13).
 *
 * The cron runs every 15 minutes. A run at local 20:07 covers the window
 * [20:00, 20:15): every reminder whose local time falls inside it is due.
 * Everything is computed in the user's own timezone (profiles.timezone), so a
 * user in Sydney and a user in Kolkata each get "wake" at their own 05:00,
 * including across DST changes.
 *
 * Pure: the cron route supplies `now`, the settings and today's progress.
 * Dedupe happens in the database (reminder_log unique on user, key, date).
 */

export const WINDOW_MINUTES = 15;
export const FALLBACK_TIMEZONE = 'Asia/Kolkata';

export interface LocalClock {
  /** Local calendar date, yyyy-MM-dd. Used for dedupe and "today". */
  date: string;
  /** Minutes since local midnight. */
  minutes: number;
  /** Start of the current 15-minute window, in minutes since local midnight. */
  windowStart: number;
  timezone: string;
}

export function isValidTimezone(timezone: string | null | undefined): timezone is string {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function localClock(now: Date, timezone: string | null | undefined): LocalClock {
  const tz = isValidTimezone(timezone) ? timezone : FALLBACK_TIMEZONE;
  const local = new TZDate(now, tz);
  const minutes = local.getHours() * 60 + local.getMinutes();
  return {
    date: format(local, 'yyyy-MM-dd'),
    minutes,
    windowStart: Math.floor(minutes / WINDOW_MINUTES) * WINDOW_MINUTES,
    timezone: tz,
  };
}

/** True when a local HH:MM falls inside the clock's current 15-minute window. */
export function inWindow(hhmm: string, clock: LocalClock): boolean {
  const t = toMinutes(hhmm);
  return t >= clock.windowStart && t < clock.windowStart + WINDOW_MINUTES;
}

/** Today's progress, used to skip reminders that are already pointless. */
export interface DayContext {
  completed: number;
  active: number;
  /** task_templates slugs completed today, e.g. "workout", "skincare_pm", "water". */
  doneSlugs: ReadonlySet<string>;
}

export interface DueReminder {
  kind: ReminderKind;
  /**
   * Dedupe key stored in reminder_log.kind. Equal to `kind`, except water,
   * which fires several times a day and gets one key per slot (water_10).
   */
  key: string;
  localDate: string;
}

/**
 * Time-based candidates only. Cheap, needs no database reads — the cron route
 * calls it first and only loads today's logs for users who have something due.
 */
export function candidateReminders(settings: ReminderSettings, clock: LocalClock): DueReminder[] {
  const due: DueReminder[] = [];
  const add = (kind: ReminderKind, key: string = kind) => due.push({ kind, key, localDate: clock.date });

  for (const kind of TIMED_KINDS) {
    const setting = settings[kind];
    if (setting.enabled && inWindow(setting.time, clock)) add(kind);
  }

  if (settings.water.enabled) {
    for (const slot of WATER_SLOTS) {
      if (inWindow(slot, clock)) add('water', `water_${slot.slice(0, 2)}`);
    }
  }

  if (settings.streak_risk.enabled && inWindow(STREAK_RISK_TIME, clock)) add('streak_risk');

  return due;
}

/** Drops candidates that today's progress makes pointless. */
export function filterByProgress(candidates: DueReminder[], day: DayContext): DueReminder[] {
  return candidates.filter((reminder) => {
    switch (reminder.kind) {
      case 'workout':
        return !day.doneSlugs.has('workout');
      case 'skincare_pm':
        return !day.doneSlugs.has('skincare_pm');
      case 'water':
        return !day.doneSlugs.has('water');
      case 'streak_risk':
        return day.active > 0 && day.completed / day.active < STREAK_RISK_THRESHOLD;
      default:
        return true;
    }
  });
}

/** True when any candidate depends on today's progress, so logs must be loaded. */
export function needsProgress(candidates: DueReminder[]): boolean {
  return candidates.some((r) => r.kind !== 'wake' && r.kind !== 'wind_down');
}

/** Both steps together, for callers that already have the day's progress. */
export function dueReminders(
  now: Date,
  timezone: string | null | undefined,
  settings: ReminderSettings,
  day: DayContext,
): DueReminder[] {
  return filterByProgress(candidateReminders(settings, localClock(now, timezone)), day);
}
