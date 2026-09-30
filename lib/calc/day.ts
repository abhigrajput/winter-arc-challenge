import { TZDate } from '@date-fns/tz';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Local-date handling. §4: log_date is always the user's local date derived
 * from profiles.timezone — never the server's UTC date. A server in UTC and a
 * user in Asia/Kolkata disagree about "today" for five and a half hours every
 * day, which is exactly when someone logs their 5am wake-up.
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const CHALLENGE_DAYS = 90;

/** ISO yyyy-MM-dd for "now" in the given timezone. */
export function localDate(timezone: string, now: Date = new Date()): string {
  return format(new TZDate(now, orDefault(timezone)), 'yyyy-MM-dd');
}

/** Shifts an ISO date by whole days. Date-only, so DST never shifts it. */
export function shiftDate(isoDate: string, days: number): string {
  return format(addDays(parseISO(isoDate), days), 'yyyy-MM-dd');
}

/**
 * §4: logs are writable for yesterday, today and tomorrow only. No backfilling
 * old days, no racing ahead.
 */
export function isWritableLogDate(
  logDate: string,
  timezone: string,
  now: Date = new Date(),
): boolean {
  const today = localDate(timezone, now);
  const offset = differenceInCalendarDays(parseISO(logDate), parseISO(today));
  return offset >= -1 && offset <= 1;
}

/** 1-based day of the 90-day challenge. 0 before the start date. */
export function challengeDay(
  challengeStart: string | null,
  timezone: string,
  now: Date = new Date(),
): number {
  if (!challengeStart) return 0;
  const today = localDate(timezone, now);
  const elapsed = differenceInCalendarDays(parseISO(today), parseISO(challengeStart));
  if (elapsed < 0) return 0;
  return Math.min(elapsed + 1, CHALLENGE_DAYS);
}

export type PhaseName = 'Foundation' | 'Build' | 'Peak' | 'Test';

export interface Phase {
  name: PhaseName;
  /** 1-based week of the challenge. */
  week: number;
  /** Week 4 and week 8 are deloads (§7). */
  deload: boolean;
  description: string;
}

/**
 * §7 structure. Weeks 1-4 Foundation (week 4 deload), 5-8 Build (week 8
 * deload), 9-12 Peak, week 13 Test.
 */
export function phaseForDay(day: number): Phase {
  const week = day <= 0 ? 1 : Math.min(13, Math.ceil(day / 7));

  if (week <= 4) {
    return {
      name: 'Foundation',
      week,
      deload: week === 4,
      description: week === 4 ? 'Deload week. Volume down, technique sharp.' : 'Technique and habits. Moderate volume.',
    };
  }
  if (week <= 8) {
    return {
      name: 'Build',
      week,
      deload: week === 8,
      description: week === 8 ? 'Deload week. Back off, let it settle.' : 'Volume up. Push the progression.',
    };
  }
  if (week <= 12) {
    return { name: 'Peak', week, deload: false, description: 'Highest intensity. Tighter diet.' };
  }
  return { name: 'Test', week, deload: false, description: 'Rep-max tests, final measurements and photos.' };
}

function orDefault(timezone: string | null | undefined): string {
  return timezone && timezone.length > 0 ? timezone : DEFAULT_TIMEZONE;
}
