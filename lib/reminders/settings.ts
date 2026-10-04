import { z } from 'zod';

/**
 * Per-user reminder preferences (§8.13). Stored as jsonb in
 * reminder_settings.settings and always read through parseReminderSettings, so
 * a missing or partial row falls back to defaults derived from the profile.
 */

export const REMINDER_KINDS = [
  'wake',
  'workout',
  'water',
  'skincare_pm',
  'wind_down',
  'streak_risk',
] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Kinds whose time the user picks. Water and streak-at-risk run on fixed times. */
export const TIMED_KINDS = ['wake', 'workout', 'skincare_pm', 'wind_down'] as const;
export type TimedKind = (typeof TIMED_KINDS)[number];

/** Water: every 2 h from 08:00 to 20:00 local, opt-in. */
export const WATER_SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'] as const;

/** Streak-at-risk: 20:00 local, only when under half of today's tasks are done. */
export const STREAK_RISK_TIME = '20:00';
export const STREAK_RISK_THRESHOLD = 0.5;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM.');

const timed = z.object({ enabled: z.boolean(), time });
const toggle = z.object({ enabled: z.boolean() });

export const reminderSettingsSchema = z.object({
  wake: timed,
  workout: timed,
  water: toggle,
  skincare_pm: timed,
  wind_down: timed,
  streak_risk: toggle,
});

export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;

export interface ReminderProfile {
  wake_time: string | null;
  sleep_target_h: number | null;
  modules: string[] | null;
}

/** Sensible defaults from the profile: wake at their wake time, wind down before bed. */
export function defaultReminderSettings(profile: ReminderProfile): ReminderSettings {
  const wake = normalizeTime(profile.wake_time) ?? '05:00';
  const sleepHours = profile.sleep_target_h && profile.sleep_target_h > 0 ? profile.sleep_target_h : 8;

  // Bedtime = wake - sleep target; wind down 30 minutes before that.
  const windDown = roundToQuarter(toMinutes(wake) - sleepHours * 60 - 30);

  return {
    wake: { enabled: true, time: wake },
    workout: { enabled: true, time: '18:00' },
    water: { enabled: false },
    skincare_pm: { enabled: (profile.modules ?? []).includes('face_skin'), time: '21:30' },
    wind_down: { enabled: true, time: fromMinutes(windDown) },
    streak_risk: { enabled: true },
  };
}

/**
 * Stored settings merged over the defaults, kind by kind. Anything malformed in
 * storage is dropped rather than failing the whole user's reminders.
 */
export function parseReminderSettings(stored: unknown, profile: ReminderProfile): ReminderSettings {
  const defaults = defaultReminderSettings(profile);
  if (!stored || typeof stored !== 'object') return defaults;

  const merged: Record<string, unknown> = { ...defaults };
  for (const kind of REMINDER_KINDS) {
    const value = (stored as Record<string, unknown>)[kind];
    const shape = reminderSettingsSchema.shape[kind];
    const candidate = { ...defaults[kind], ...(typeof value === 'object' && value ? value : {}) };
    const result = shape.safeParse(candidate);
    if (result.success) merged[kind] = result.data;
  }
  return reminderSettingsSchema.parse(merged);
}

// ---------------------------------------------------------------------------
// time helpers
// ---------------------------------------------------------------------------

/** "05:00:00" or "5:00" → "05:00"; anything else → null. */
export function normalizeTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes since midnight (any integer, wraps around the day) → "HH:MM". */
export function fromMinutes(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

function roundToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}
