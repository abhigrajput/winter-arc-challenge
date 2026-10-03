import type { LeaderboardRow } from '@/lib/supabase/types';

/**
 * Leaderboard (§8.12). Ranks discipline only — points, then streak. Never
 * weight, calories, body fat or photos (§4). The rows come from the
 * get_leaderboard RPC, which only returns public, onboarded users.
 */

export const LEADERBOARD_RANGES = {
  week: { label: 'This week', days: 7 },
  all: { label: 'All time', days: 3650 },
} as const;

export type LeaderboardRange = keyof typeof LEADERBOARD_RANGES;

export const LEADERBOARD_LIMIT = 100;

export function parseRange(value: string | string[] | undefined): LeaderboardRange {
  return value === 'all' ? 'all' : 'week';
}

export interface RankedRow extends LeaderboardRow {
  rank: number;
}

/**
 * Sorts by points, then streak, and assigns competition ranks: equal points and
 * streak share a rank, and the next rank skips (1, 1, 3).
 */
export function rankRows(rows: LeaderboardRow[]): RankedRow[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.current_streak - a.current_streak ||
      (a.username ?? '').localeCompare(b.username ?? ''),
  );

  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    const tied =
      previous !== undefined &&
      previous.points === row.points &&
      previous.current_streak === row.current_streak;
    return { ...row, rank: tied ? rankOf(sorted, index - 1) : index + 1 };
  });
}

function rankOf(sorted: LeaderboardRow[], index: number): number {
  let i = index;
  while (
    i > 0 &&
    sorted[i - 1]!.points === sorted[i]!.points &&
    sorted[i - 1]!.current_streak === sorted[i]!.current_streak
  ) {
    i -= 1;
  }
  return i + 1;
}
