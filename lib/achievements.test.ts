import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_BY_CODE,
  earnedAchievements,
  longestPerfectRun,
  sortForDisplay,
  type AchievementInput,
} from './achievements';

const none: AchievementInput = {
  days: [],
  longestStreak: 0,
  workoutSessions: 0,
  personalRecords: 0,
  bestPullUpReps: 0,
  suryaRounds: 0,
  gitaChapters: 0,
  contentPosts: 0,
  challengeDay: 1,
};

const day = (date: string, completed: number, active = 10) => ({ date, completed, active });

describe('ACHIEVEMENTS', () => {
  it('covers every badge §8.11 lists', () => {
    const codes = ACHIEVEMENTS.map((a) => a.code);
    for (const expected of [
      'first_workout',
      'streak_7',
      'streak_30',
      'streak_60',
      'streak_90',
      'ten_prs',
      'first_pull_up',
      'surya_100',
      'gita_18',
      'posts_30',
      'perfect_week',
      'finisher',
    ]) {
      expect(codes, expected).toContain(expected);
    }
  });

  it('has unique codes', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.code)).size).toBe(ACHIEVEMENTS.length);
    expect(ACHIEVEMENT_BY_CODE.size).toBe(ACHIEVEMENTS.length);
  });

  it('gives every badge a name and description', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length, a.code).toBeGreaterThan(0);
      expect(a.description.length, a.code).toBeGreaterThan(0);
    }
  });
});

describe('earnedAchievements', () => {
  it('awards nothing to a fresh user', () => {
    expect(earnedAchievements(none)).toEqual([]);
  });

  it('awards the first workout', () => {
    expect(earnedAchievements({ ...none, workoutSessions: 1 })).toContain('first_workout');
  });

  it('awards the first pull-up only once one is logged', () => {
    expect(earnedAchievements({ ...none, bestPullUpReps: 0 })).not.toContain('first_pull_up');
    expect(earnedAchievements({ ...none, bestPullUpReps: 1 })).toContain('first_pull_up');
  });

  it('awards 10 PRs at exactly ten', () => {
    expect(earnedAchievements({ ...none, personalRecords: 9 })).not.toContain('ten_prs');
    expect(earnedAchievements({ ...none, personalRecords: 10 })).toContain('ten_prs');
  });

  it('awards 100 Surya Namaskar on the total, not per day', () => {
    expect(earnedAchievements({ ...none, suryaRounds: 99 })).not.toContain('surya_100');
    expect(earnedAchievements({ ...none, suryaRounds: 100 })).toContain('surya_100');
  });

  it('awards the Gita badge only at all 18 chapters', () => {
    expect(earnedAchievements({ ...none, gitaChapters: 17 })).not.toContain('gita_18');
    expect(earnedAchievements({ ...none, gitaChapters: 18 })).toContain('gita_18');
  });

  it('awards 30 posts', () => {
    expect(earnedAchievements({ ...none, contentPosts: 30 })).toContain('posts_30');
  });

  it('awards every streak tier at or below the longest run', () => {
    const earned = earnedAchievements({ ...none, longestStreak: 60 });
    expect(earned).toContain('streak_7');
    expect(earned).toContain('streak_30');
    expect(earned).toContain('streak_60');
    expect(earned).not.toContain('streak_90');
  });

  it('awards the finisher at day 90', () => {
    expect(earnedAchievements({ ...none, challengeDay: 89 })).not.toContain('finisher');
    expect(earnedAchievements({ ...none, challengeDay: 90 })).toContain('finisher');
  });

  it('awards a perfect week after seven flawless days in a row', () => {
    const days = Array.from({ length: 7 }, (_, i) => day(`2026-10-0${i + 1}`, 10));
    expect(earnedAchievements({ ...none, days })).toContain('perfect_week');
  });

  it('does not award a perfect week for seven good-but-not-perfect days', () => {
    const days = Array.from({ length: 7 }, (_, i) => day(`2026-10-0${i + 1}`, 9));
    expect(earnedAchievements({ ...none, days })).not.toContain('perfect_week');
  });
});

describe('longestPerfectRun', () => {
  it('counts an unbroken run of full days', () => {
    const days = [day('2026-10-01', 10), day('2026-10-02', 10), day('2026-10-03', 10)];
    expect(longestPerfectRun(days)).toBe(3);
  });

  it('resets on an imperfect day', () => {
    const days = [
      day('2026-10-01', 10),
      day('2026-10-02', 8),
      day('2026-10-03', 10),
      day('2026-10-04', 10),
    ];
    expect(longestPerfectRun(days)).toBe(2);
  });

  it('resets across a calendar gap', () => {
    const days = [day('2026-10-01', 10), day('2026-10-05', 10), day('2026-10-06', 10)];
    expect(longestPerfectRun(days)).toBe(2);
  });

  it('ignores days with nothing active', () => {
    const days = [day('2026-10-01', 0, 0), day('2026-10-02', 10)];
    expect(longestPerfectRun(days)).toBe(1);
  });

  it('sorts unordered input', () => {
    const days = [day('2026-10-03', 10), day('2026-10-01', 10), day('2026-10-02', 10)];
    expect(longestPerfectRun(days)).toBe(3);
  });

  it('is 0 with no history', () => {
    expect(longestPerfectRun([])).toBe(0);
  });
});

describe('sortForDisplay', () => {
  it('puts earned badges first', () => {
    const sorted = sortForDisplay(new Set(['finisher']));
    expect(sorted[0]!.code).toBe('finisher');
    expect(sorted[0]!.earned).toBe(true);
  });

  it('keeps display order within each group', () => {
    const sorted = sortForDisplay(new Set(['streak_7', 'first_workout']));
    expect(sorted.slice(0, 2).map((a) => a.code)).toEqual(['first_workout', 'streak_7']);
  });

  it('returns every badge, earned or not', () => {
    expect(sortForDisplay(new Set())).toHaveLength(ACHIEVEMENTS.length);
  });
});
