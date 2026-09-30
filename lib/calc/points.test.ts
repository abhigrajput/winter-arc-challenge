import { describe, expect, it } from 'vitest';
import { POINTS, computePoints, dayPoints, todayProgress } from './points';

const day = (date: string, completed: number, active = 10) => ({ date, completed, active });

describe('POINTS', () => {
  it('matches the values in §4', () => {
    expect(POINTS).toEqual({ task: 10, fullDay: 20, workout: 15, checkin: 25 });
  });
});

describe('dayPoints', () => {
  it('awards 10 per task', () => {
    expect(dayPoints(day('2026-09-30', 6))).toBe(60);
  });

  it('adds the 20-point bonus for a full day', () => {
    expect(dayPoints(day('2026-09-30', 10))).toBe(120);
  });

  it('gives no bonus at 80%', () => {
    expect(dayPoints(day('2026-09-30', 8))).toBe(80);
  });

  it('is 0 for an empty day', () => {
    expect(dayPoints(day('2026-09-30', 0))).toBe(0);
  });
});

describe('computePoints', () => {
  it('sums tasks, full days, workouts and check-ins', () => {
    const result = computePoints({
      days: [day('2026-09-29', 10), day('2026-09-30', 6)],
      workoutSessions: 3,
      checkins: 2,
    });

    expect(result.tasks).toBe(160); // 16 tasks x 10
    expect(result.fullDays).toBe(20); // one full day
    expect(result.workouts).toBe(45); // 3 x 15
    expect(result.checkins).toBe(50); // 2 x 25
    expect(result.total).toBe(275);
  });

  it('is 0 for a user with no history', () => {
    expect(computePoints({ days: [], workoutSessions: 0, checkins: 0 }).total).toBe(0);
  });

  it('does not award a full-day bonus when nothing is active', () => {
    const result = computePoints({
      days: [{ date: '2026-09-30', completed: 0, active: 0 }],
      workoutSessions: 0,
      checkins: 0,
    });
    expect(result.fullDays).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('todayProgress', () => {
  it('reports the percentage for the header', () => {
    expect(todayProgress(day('2026-09-30', 5)).percent).toBe(50);
    expect(todayProgress(day('2026-09-30', 0)).percent).toBe(0);
  });

  it('flags a full day', () => {
    expect(todayProgress(day('2026-09-30', 10)).full).toBe(true);
    expect(todayProgress(day('2026-09-30', 9)).full).toBe(false);
  });

  it('flags when the streak day is banked', () => {
    expect(todayProgress(day('2026-09-30', 8)).streakSafe).toBe(true);
    expect(todayProgress(day('2026-09-30', 7)).streakSafe).toBe(false);
  });

  it('counts how many more tasks bank the streak', () => {
    expect(todayProgress(day('2026-09-30', 5)).tasksToStreak).toBe(3);
    expect(todayProgress(day('2026-09-30', 8)).tasksToStreak).toBe(0);
    expect(todayProgress(day('2026-09-30', 10)).tasksToStreak).toBe(0);
  });

  it('rounds the 80% bar up, so 4 of 5 is needed not 3', () => {
    const progress = todayProgress({ date: '2026-09-30', completed: 0, active: 5 });
    expect(progress.tasksToStreak).toBe(4);
  });

  it('handles a day with no active tasks', () => {
    const progress = todayProgress({ date: '2026-09-30', completed: 0, active: 0 });
    expect(progress.percent).toBe(0);
    expect(progress.full).toBe(false);
    expect(progress.streakSafe).toBe(false);
  });
});
