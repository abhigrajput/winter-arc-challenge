import { describe, expect, it } from 'vitest';
import {
  ADJUST_FAST_GAIN_KCAL,
  ADJUST_FAST_LOSS_KCAL,
  ADJUST_STALL_KCAL,
  autoAdjustCalories,
  boundSuggestedAdjustment,
  reconcileAdjustment,
} from './adjust';
import { CALORIE_FLOOR } from './guardrails';

const base = {
  sex: 'male' as const,
  age: 25,
  weightKg: 85,
  currentCalories: 2400,
  maintenanceCalories: 2800,
};

describe('autoAdjustCalories — fat loss', () => {
  const cutting = { ...base, goal: 'fat_loss' as const };

  it('adds calories when losing faster than 1% of bodyweight', () => {
    // 85 kg: anything beyond 0.85 kg/week is too fast.
    const result = autoAdjustCalories({
      ...cutting,
      weeklyChangeKg: -1.2,
      previousWeeklyChangeKg: -1.0,
    });
    expect(result.deltaKcal).toBe(ADJUST_FAST_LOSS_KCAL);
    expect(result.newCalories).toBe(2550);
    expect(result.reason).toMatch(/faster than is useful/i);
  });

  it('holds when the rate is sensible', () => {
    const result = autoAdjustCalories({
      ...cutting,
      weeklyChangeKg: -0.5,
      previousWeeklyChangeKg: -0.5,
    });
    expect(result.deltaKcal).toBe(0);
    expect(result.reason).toMatch(/hold the target/i);
  });

  it('cuts after two flat weeks', () => {
    const result = autoAdjustCalories({
      ...cutting,
      weeklyChangeKg: 0,
      previousWeeklyChangeKg: 0.05,
    });
    expect(result.deltaKcal).toBe(ADJUST_STALL_KCAL);
    expect(result.newCalories).toBe(2250);
    expect(result.reason).toMatch(/two flat weeks/i);
  });

  it('does not cut after a single flat week', () => {
    const result = autoAdjustCalories({
      ...cutting,
      weeklyChangeKg: 0,
      previousWeeklyChangeKg: -0.6,
    });
    expect(result.deltaKcal).toBe(0);
  });

  it('does not cut when the previous week is unknown', () => {
    const result = autoAdjustCalories({
      ...cutting,
      weeklyChangeKg: 0,
      previousWeeklyChangeKg: null,
    });
    expect(result.deltaKcal).toBe(0);
  });

  it('never cuts below the calorie floor', () => {
    const result = autoAdjustCalories({
      ...cutting,
      sex: 'female',
      weightKg: 48,
      currentCalories: 1250,
      maintenanceCalories: 1700,
      weeklyChangeKg: 0,
      previousWeeklyChangeKg: 0,
    });
    expect(result.newCalories).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
    expect(result.applied.length).toBeGreaterThan(0);
  });

  it('treats six_pack the same as fat loss', () => {
    const sixPack = autoAdjustCalories({
      ...base,
      goal: 'six_pack',
      weeklyChangeKg: -1.5,
      previousWeeklyChangeKg: -1.5,
    });
    expect(sixPack.deltaKcal).toBe(ADJUST_FAST_LOSS_KCAL);
  });
});

describe('autoAdjustCalories — lean bulk', () => {
  const bulking = { ...base, goal: 'lean_bulk' as const, currentCalories: 3100 };

  it('trims calories when gaining faster than 0.5 kg a week', () => {
    const result = autoAdjustCalories({
      ...bulking,
      weeklyChangeKg: 0.9,
      previousWeeklyChangeKg: 0.8,
    });
    expect(result.deltaKcal).toBe(ADJUST_FAST_GAIN_KCAL);
    expect(result.newCalories).toBe(3000);
    expect(result.reason).toMatch(/mostly fat/i);
  });

  it('holds at a sensible gain', () => {
    const result = autoAdjustCalories({
      ...bulking,
      weeklyChangeKg: 0.3,
      previousWeeklyChangeKg: 0.3,
    });
    expect(result.deltaKcal).toBe(0);
  });

  it('adds calories after two weeks without gaining', () => {
    const result = autoAdjustCalories({
      ...bulking,
      weeklyChangeKg: 0,
      previousWeeklyChangeKg: 0,
    });
    expect(result.deltaKcal).toBe(ADJUST_FAST_LOSS_KCAL);
    expect(result.reason).toMatch(/restarts progress/i);
  });
});

describe('autoAdjustCalories — other goals', () => {
  it('leaves maintenance goals alone', () => {
    for (const goal of ['discipline', 'spiritual', 'recomp'] as const) {
      const result = autoAdjustCalories({
        ...base,
        goal,
        weeklyChangeKg: -1.5,
        previousWeeklyChangeKg: -1.5,
      });
      expect(result.deltaKcal, goal).toBe(0);
    }
  });

  it('holds when there is no weight data', () => {
    const result = autoAdjustCalories({
      ...base,
      goal: 'fat_loss',
      weeklyChangeKg: null,
      previousWeeklyChangeKg: null,
    });
    expect(result.deltaKcal).toBe(0);
    expect(result.reason).toMatch(/not enough weight data/i);
  });

  it('always returns a usable target', () => {
    const result = autoAdjustCalories({
      ...base,
      goal: 'fat_loss',
      weeklyChangeKg: null,
      previousWeeklyChangeKg: null,
    });
    expect(result.newCalories).toBeGreaterThan(0);
  });
});

describe('boundSuggestedAdjustment', () => {
  it('keeps a sensible suggestion', () => {
    expect(boundSuggestedAdjustment(100)).toBe(100);
    expect(boundSuggestedAdjustment(-100)).toBe(-100);
  });

  it('clamps an over-eager model to the §6 range', () => {
    expect(boundSuggestedAdjustment(900)).toBe(ADJUST_FAST_LOSS_KCAL);
    expect(boundSuggestedAdjustment(-900)).toBe(ADJUST_STALL_KCAL);
  });

  it('treats nonsense as no change', () => {
    // Neither NaN nor Infinity is finite, so both fall through to "leave it alone"
    // rather than being clamped to a real adjustment.
    expect(boundSuggestedAdjustment(Number.NaN)).toBe(0);
    expect(boundSuggestedAdjustment(Number.POSITIVE_INFINITY)).toBe(0);
    expect(boundSuggestedAdjustment(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('rounds to whole calories', () => {
    expect(boundSuggestedAdjustment(37.6)).toBe(38);
  });
});

describe('reconcileAdjustment', () => {
  it('does nothing when the rules say hold, whatever the model wants', () => {
    expect(reconcileAdjustment(0, 150)).toBe(0);
    expect(reconcileAdjustment(0, -150)).toBe(0);
  });

  it('uses the rule when the model has no opinion', () => {
    expect(reconcileAdjustment(150, 0)).toBe(150);
    expect(reconcileAdjustment(-150, 0)).toBe(-150);
  });

  it('ignores a model pulling the opposite way', () => {
    expect(reconcileAdjustment(150, -150)).toBe(150);
    expect(reconcileAdjustment(-150, 150)).toBe(-150);
  });

  it('lets the model soften a change but never amplify it', () => {
    expect(reconcileAdjustment(150, 50)).toBe(50);
    expect(reconcileAdjustment(150, 400)).toBe(150);
    expect(reconcileAdjustment(-150, -50)).toBe(-50);
    expect(reconcileAdjustment(-150, -400)).toBe(-150);
  });

  it('never returns a bigger cut than the rules allow', () => {
    for (const model of [-1000, -500, -151, 0, 500]) {
      expect(Math.abs(reconcileAdjustment(-150, model))).toBeLessThanOrEqual(150);
    }
  });
});
