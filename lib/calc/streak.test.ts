import { describe, expect, it } from 'vitest';
import { STREAK_THRESHOLD, computeStreak, dayRatio, isStreakDay } from './streak';

const day = (date: string, completed: number, active = 10) => ({ date, completed, active });

describe('dayRatio', () => {
  it('is the completed fraction', () => {
    expect(dayRatio({ completed: 8, active: 10 })).toBe(0.8);
  });

  it('is 0 when nothing is active', () => {
    expect(dayRatio({ completed: 0, active: 0 })).toBe(0);
  });

  it('never exceeds 1', () => {
    expect(dayRatio({ completed: 12, active: 10 })).toBe(1);
  });
});

describe('isStreakDay', () => {
  it('needs 80% of the active tasks', () => {
    expect(STREAK_THRESHOLD).toBe(0.8);
    expect(isStreakDay({ completed: 8, active: 10 })).toBe(true);
    expect(isStreakDay({ completed: 7, active: 10 })).toBe(false);
  });

  it('uses the per-day denominator', () => {
    // 4 of 5 clears the bar even though 4 of 10 would not.
    expect(isStreakDay({ completed: 4, active: 5 })).toBe(true);
    expect(isStreakDay({ completed: 4, active: 10 })).toBe(false);
  });

  it('is false for a day with no active tasks', () => {
    expect(isStreakDay({ completed: 0, active: 0 })).toBe(false);
  });
});

describe('computeStreak', () => {
  it('counts back from today when today already qualifies', () => {
    const days = [day('2026-09-28', 9), day('2026-09-29', 10), day('2026-09-30', 8)];
    const result = computeStreak(days, '2026-09-30');
    expect(result.current).toBe(3);
    expect(result.todayCounted).toBe(true);
  });

  it('does not break the run when today is still in progress', () => {
    // Today at 3/10 has not failed yet — there is time left in the day.
    const days = [day('2026-09-28', 9), day('2026-09-29', 10), day('2026-09-30', 3)];
    const result = computeStreak(days, '2026-09-30');
    expect(result.current).toBe(2);
    expect(result.todayCounted).toBe(false);
  });

  it('breaks on a missed day before today', () => {
    const days = [day('2026-09-27', 10), day('2026-09-28', 2), day('2026-09-29', 10)];
    expect(computeStreak(days, '2026-09-30').current).toBe(1);
  });

  it('is 0 when yesterday was missed and today is not done yet', () => {
    const days = [day('2026-09-29', 1), day('2026-09-30', 1)];
    expect(computeStreak(days, '2026-09-30').current).toBe(0);
  });

  it('is 0 with no history', () => {
    expect(computeStreak([], '2026-09-30')).toEqual({
      current: 0,
      longest: 0,
      todayCounted: false,
    });
  });

  it('tracks the longest run separately from the current one', () => {
    const days = [
      day('2026-09-01', 10),
      day('2026-09-02', 10),
      day('2026-09-03', 10),
      day('2026-09-04', 10),
      // gap
      day('2026-09-10', 10),
      day('2026-09-11', 10),
    ];
    const result = computeStreak(days, '2026-09-11');
    expect(result.current).toBe(2);
    expect(result.longest).toBe(4);
  });

  it('ignores days that fell short when measuring the longest run', () => {
    const days = [day('2026-09-01', 10), day('2026-09-02', 3), day('2026-09-03', 10)];
    expect(computeStreak(days, '2026-09-03').longest).toBe(1);
  });

  it('counts an unbroken run across a month boundary', () => {
    const days = [
      day('2026-09-28', 10),
      day('2026-09-29', 10),
      day('2026-09-30', 10),
      day('2026-10-01', 10),
      day('2026-10-02', 10),
    ];
    expect(computeStreak(days, '2026-10-02').current).toBe(5);
  });
});
