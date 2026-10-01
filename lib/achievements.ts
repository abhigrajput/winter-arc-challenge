import type { DaySummary } from '@/lib/calc/streak';
import { CHALLENGE_DAYS } from '@/lib/calc/day';

/**
 * Achievements (§8.11). Pure evaluation: given a snapshot of what the user has
 * done, return which badges are earned. Awarding and persistence happen in
 * lib/achievements/award.ts.
 *
 * Codes are stored in achievements.code, which the database leaves as free
 * text, so this file is the only definition of them.
 */

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  /** Rough ordering for display: lower appears first. */
  order: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_workout', name: 'First session', description: 'Logged your first workout.', order: 1 },
  { code: 'first_pull_up', name: 'First pull-up', description: 'Logged a full pull-up.', order: 2 },
  { code: 'streak_7', name: '7-day streak', description: 'Seven days in a row at 80% or better.', order: 3 },
  { code: 'perfect_week', name: 'Perfect week', description: 'Seven days in a row with everything done.', order: 4 },
  { code: 'ten_prs', name: '10 PRs', description: 'Ten personal records logged.', order: 5 },
  { code: 'surya_100', name: '100 Surya Namaskar', description: 'A hundred rounds, all told.', order: 6 },
  { code: 'streak_30', name: '30-day streak', description: 'A full month without breaking.', order: 7 },
  { code: 'posts_30', name: '30 posts', description: 'Thirty pieces of content published.', order: 8 },
  { code: 'gita_18', name: 'All 18 chapters', description: 'Finished the Bhagavad Gita.', order: 9 },
  { code: 'streak_60', name: '60-day streak', description: 'Two months unbroken.', order: 10 },
  { code: 'streak_90', name: '90-day streak', description: 'The whole arc, every day.', order: 11 },
  { code: 'finisher', name: '90-day finisher', description: 'Reached day 90.', order: 12 },
];

export const ACHIEVEMENT_BY_CODE = new Map(ACHIEVEMENTS.map((a) => [a.code, a]));

export interface AchievementInput {
  /** Per-day completion, oldest first. */
  days: DaySummary[];
  longestStreak: number;
  workoutSessions: number;
  personalRecords: number;
  /** Best single-set reps on a full pull-up. */
  bestPullUpReps: number;
  /** Total Surya Namaskar rounds logged. */
  suryaRounds: number;
  gitaChapters: number;
  contentPosts: number;
  /** 1-based day of the challenge. */
  challengeDay: number;
}

/** Longest run of consecutive days where every active task was done. */
export function longestPerfectRun(days: DaySummary[]): number {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const day of sorted) {
    const perfect = day.active > 0 && day.completed >= day.active;
    const consecutive = previous !== null && dayAfter(previous) === day.date;

    run = perfect ? (consecutive ? run + 1 : 1) : 0;
    if (run > longest) longest = run;
    previous = day.date;
  }

  return longest;
}

/** Codes the user has earned, given everything they have done. */
export function earnedAchievements(input: AchievementInput): string[] {
  const earned: string[] = [];

  if (input.workoutSessions >= 1) earned.push('first_workout');
  if (input.bestPullUpReps >= 1) earned.push('first_pull_up');
  if (input.personalRecords >= 10) earned.push('ten_prs');
  if (input.suryaRounds >= 100) earned.push('surya_100');
  if (input.gitaChapters >= 18) earned.push('gita_18');
  if (input.contentPosts >= 30) earned.push('posts_30');

  if (input.longestStreak >= 7) earned.push('streak_7');
  if (input.longestStreak >= 30) earned.push('streak_30');
  if (input.longestStreak >= 60) earned.push('streak_60');
  if (input.longestStreak >= 90) earned.push('streak_90');

  if (longestPerfectRun(input.days) >= 7) earned.push('perfect_week');
  if (input.challengeDay >= CHALLENGE_DAYS) earned.push('finisher');

  return earned;
}

/** Earned badges first, then the rest in display order. */
export function sortForDisplay(
  earnedCodes: Set<string>,
): (AchievementDef & { earned: boolean })[] {
  return [...ACHIEVEMENTS]
    .map((a) => ({ ...a, earned: earnedCodes.has(a.code) }))
    .sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return a.order - b.order;
    });
}

function dayAfter(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
