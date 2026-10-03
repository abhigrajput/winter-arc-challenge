import { describe, expect, it } from 'vitest';
import { parseRange, rankRows } from './leaderboard';
import type { LeaderboardRow } from './supabase/types';

function row(username: string, points: number, current_streak = 0): LeaderboardRow {
  return { user_id: username, username, display_name: username, avatar_url: null, points, current_streak };
}

describe('parseRange', () => {
  it('defaults to the weekly board', () => {
    expect(parseRange(undefined)).toBe('week');
    expect(parseRange('nonsense')).toBe('week');
    expect(parseRange(['all'])).toBe('week');
  });

  it('accepts all-time', () => {
    expect(parseRange('all')).toBe('all');
  });
});

describe('rankRows', () => {
  it('orders by points, then streak', () => {
    const ranked = rankRows([row('a', 100, 1), row('b', 300, 0), row('c', 100, 5)]);
    expect(ranked.map((r) => r.username)).toEqual(['b', 'c', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('gives full ties the same rank and skips the next', () => {
    const ranked = rankRows([row('a', 200, 3), row('b', 200, 3), row('c', 200, 3), row('d', 50)]);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 1, 4]);
  });

  it('handles an empty board', () => {
    expect(rankRows([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const input = [row('a', 1), row('b', 2)];
    rankRows(input);
    expect(input.map((r) => r.username)).toEqual(['a', 'b']);
  });
});
