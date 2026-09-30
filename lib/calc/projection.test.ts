import { describe, expect, it } from 'vitest';
import { CHALLENGE_DAYS, projectWeight, weeksToBodyFat } from './projection';

describe('projectWeight', () => {
  const base = { weightKg: 85, maintenance: 2800, goal: 'fat_loss' as const };

  it('turns a daily deficit into a weekly rate', () => {
    // 400 kcal/day -> 2800 kcal/week -> 2800/7700 = 0.36 kg/week
    const result = projectWeight({ ...base, calorieTarget: 2400 });
    expect(result.weeklyRateKg).toBeCloseTo(-0.36, 2);
    expect(result.maintenance).toBe(false);
  });

  it('projects a lower weight over 90 days on a deficit', () => {
    const result = projectWeight({ ...base, calorieTarget: 2400 });
    expect(result.lowKg).toBeLessThan(base.weightKg);
    expect(result.highKg).toBeLessThan(base.weightKg);
    expect(result.days).toBe(CHALLENGE_DAYS);
  });

  it('orders the range low to high', () => {
    const cut = projectWeight({ ...base, calorieTarget: 2400 });
    expect(cut.lowKg).toBeLessThanOrEqual(cut.highKg);

    const bulk = projectWeight({
      weightKg: 65,
      maintenance: 2500,
      goal: 'lean_bulk',
      calorieTarget: 2800,
    });
    expect(bulk.lowKg).toBeLessThanOrEqual(bulk.highKg);
    expect(bulk.highKg).toBeGreaterThan(65);
  });

  it('makes the conservative end a smaller change than the optimistic end', () => {
    const r = projectWeight({ ...base, calorieTarget: 2400 });
    const optimisticChange = Math.abs(r.optimisticKg - base.weightKg);
    const conservativeChange = Math.abs(r.conservativeKg - base.weightKg);
    expect(conservativeChange).toBeLessThan(optimisticChange);
  });

  it('projects no change for maintenance goals', () => {
    for (const goal of ['discipline', 'spiritual'] as const) {
      const result = projectWeight({ weightKg: 70, maintenance: 2400, calorieTarget: 2400, goal });
      expect(result.maintenance).toBe(true);
      expect(result.totalChangeKg).toBe(0);
      expect(result.lowKg).toBe(70);
      expect(result.highKg).toBe(70);
    }
  });

  it('treats a zero gap as maintenance even on a fat-loss goal', () => {
    const result = projectWeight({ ...base, calorieTarget: 2800 });
    expect(result.maintenance).toBe(true);
    expect(result.weeklyRateKg).toBe(0);
  });

  it('scales with the window length', () => {
    const ninety = projectWeight({ ...base, calorieTarget: 2400 });
    const thirty = projectWeight({ ...base, calorieTarget: 2400, days: 30 });
    expect(Math.abs(thirty.totalChangeKg)).toBeLessThan(Math.abs(ninety.totalChangeKg));
  });
});

describe('weeksToBodyFat', () => {
  it('estimates a range of weeks at the current rate', () => {
    const result = weeksToBodyFat(20, 12, -0.5, 85);
    expect(result).not.toBeNull();
    expect(result!.low).toBeGreaterThan(0);
    expect(result!.high).toBeGreaterThanOrEqual(result!.low);
  });

  it('returns null when already at or below the target', () => {
    expect(weeksToBodyFat(11, 12, -0.5, 80)).toBeNull();
    expect(weeksToBodyFat(12, 12, -0.5, 80)).toBeNull();
  });

  it('returns null when not losing weight', () => {
    expect(weeksToBodyFat(20, 12, 0, 80)).toBeNull();
    expect(weeksToBodyFat(20, 12, 0.3, 80)).toBeNull();
  });

  it('takes longer at a slower rate', () => {
    const fast = weeksToBodyFat(22, 12, -0.7, 90)!;
    const slow = weeksToBodyFat(22, 12, -0.3, 90)!;
    expect(slow.low).toBeGreaterThan(fast.low);
  });
});
