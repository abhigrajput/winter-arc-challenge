import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

/**
 * Streaks. §4: a day counts toward the streak when at least 80% of that day's
 * ACTIVE tasks are done. The denominator is per-day, so turning a task off
 * later never retroactively breaks an earned day.
 */

export const STREAK_THRESHOLD = 0.8;

export interface DaySummary {
  /** Local ISO date, yyyy-MM-dd. */
  date: string;
  completed: number;
  active: number;
}

/** Fraction of the day's active tasks completed, 0..1. */
export function dayRatio(day: Pick<DaySummary, 'completed' | 'active'>): number {
  if (day.active <= 0) return 0;
  return Math.min(1, day.completed / day.active);
}

/** True when the day clears the 80% bar. */
export function isStreakDay(day: Pick<DaySummary, 'completed' | 'active'>): boolean {
  return day.active > 0 && dayRatio(day) >= STREAK_THRESHOLD;
}

export interface StreakResult {
  current: number;
  longest: number;
  /** True when today itself is already banked. */
  todayCounted: boolean;
}

/**
 * Current and longest streak.
 *
 * `today` is the user's local date. Today not yet being at 80% does NOT break
 * the run — there is still time left in the day — so the current streak is
 * counted back from today if today qualifies, otherwise from yesterday. A gap
 * anywhere earlier ends it.
 */
export function computeStreak(days: DaySummary[], today: string): StreakResult {
  const qualifying = new Set(days.filter(isStreakDay).map((d) => d.date));

  const todayCounted = qualifying.has(today);
  let cursor = todayCounted ? today : shift(today, -1);
  let current = 0;

  while (qualifying.has(cursor)) {
    current += 1;
    cursor = shift(cursor, -1);
  }

  return { current, longest: longestRun(qualifying), todayCounted };
}

/** Longest consecutive run of qualifying days anywhere in the history. */
function longestRun(qualifying: Set<string>): number {
  const sorted = [...qualifying].sort();
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const date of sorted) {
    const consecutive =
      previous !== null && differenceInCalendarDays(parseISO(date), parseISO(previous)) === 1;
    run = consecutive ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = date;
  }

  return longest;
}

/** Calendar-date arithmetic. Never round-trip through UTC here: toISOString()
 *  shifts the date for any timezone ahead of UTC. */
export interface LogRow {
  log_date: string | null;
  completed: boolean | null;
  /** Whether the owning task is active right now. */
  active?: boolean | null;
}

/**
 * Rolls raw daily_logs rows up per day.
 *
 * Past days count every log row that exists for that date, so a task switched
 * off later never rewrites a streak day already earned.
 *
 * Today and later skip rows whose task is currently inactive: those are tasks
 * the user has just turned off, and leaving them in the denominator would make
 * the day permanently unfinishable. (The rows cannot simply be deleted — the
 * live database has no DELETE policy on daily_logs.)
 */
export function summariseDays(logs: LogRow[], today?: string): DaySummary[] {
  const byDate = new Map<string, DaySummary>();

  for (const log of logs) {
    if (!log.log_date) continue;
    const isCurrentOrFuture = today !== undefined && log.log_date >= today;
    if (isCurrentOrFuture && log.active === false) continue;
    const entry = byDate.get(log.log_date) ?? { date: log.log_date, completed: 0, active: 0 };
    entry.active += 1;
    if (log.completed) entry.completed += 1;
    byDate.set(log.log_date, entry);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function shift(isoDate: string, days: number): string {
  return format(addDays(parseISO(isoDate), days), 'yyyy-MM-dd');
}
