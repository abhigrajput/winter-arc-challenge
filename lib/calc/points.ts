import { isStreakDay, type DaySummary } from '@/lib/calc/streak';

/**
 * Points. §4, and the only thing the leaderboard ever ranks (§8.12).
 * Discipline only: no weight, no calories, no body fat, no photos.
 */

export const POINTS = {
  /** Per task completed. */
  task: 10,
  /** Bonus when every active task for the day is done. */
  fullDay: 20,
  /** Per workout session logged. */
  workout: 15,
  /** Per weekly check-in submitted. */
  checkin: 25,
} as const;

export interface PointsInput {
  days: DaySummary[];
  workoutSessions: number;
  checkins: number;
}

export interface PointsBreakdown {
  tasks: number;
  fullDays: number;
  workouts: number;
  checkins: number;
  total: number;
}

/** Points earned for a single day's task completions. */
export function dayPoints(day: DaySummary): number {
  const tasks = day.completed * POINTS.task;
  const full = day.active > 0 && day.completed >= day.active ? POINTS.fullDay : 0;
  return tasks + full;
}

export function computePoints({ days, workoutSessions, checkins }: PointsInput): PointsBreakdown {
  let tasks = 0;
  let fullDays = 0;

  for (const day of days) {
    tasks += day.completed * POINTS.task;
    if (day.active > 0 && day.completed >= day.active) fullDays += POINTS.fullDay;
  }

  const workouts = workoutSessions * POINTS.workout;
  const checkinPoints = checkins * POINTS.checkin;

  return {
    tasks,
    fullDays,
    workouts,
    checkins: checkinPoints,
    total: tasks + fullDays + workouts + checkinPoints,
  };
}

export interface TodayProgress {
  completed: number;
  active: number;
  /** 0..100, rounded, for the header. */
  percent: number;
  /** Every active task done. */
  full: boolean;
  /** At or past the 80% streak bar. */
  streakSafe: boolean;
  /** Tasks still needed to bank the streak day. */
  tasksToStreak: number;
}

export function todayProgress(day: DaySummary): TodayProgress {
  const percent = day.active > 0 ? Math.round((day.completed / day.active) * 100) : 0;
  const needed = Math.ceil(day.active * 0.8);

  return {
    completed: day.completed,
    active: day.active,
    percent,
    full: day.active > 0 && day.completed >= day.active,
    streakSafe: isStreakDay(day),
    tasksToStreak: Math.max(0, needed - day.completed),
  };
}
