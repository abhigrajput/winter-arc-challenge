import { describe, expect, it } from 'vitest';
import { KCAL_PER_G, calorieTarget, macroTargets, waterTargetMl } from './macros';
import { CALORIE_FLOOR } from './guardrails';

const adultMale = { sex: 'male' as const, age: 25, weightKg: 80 };

describe('calorieTarget', () => {
  it('puts fat loss 300-500 under maintenance', () => {
    const result = calorieTarget({ tdee: 2800, goal: 'fat_loss', ...adultMale });
    expect(result.min).toBe(2300);
    expect(result.max).toBe(2500);
    expect(result.target).toBe(2400);
    expect(result.maintenance).toBe(2800);
  });

  it('treats six_pack the same as fat loss', () => {
    const sixPack = calorieTarget({ tdee: 2800, goal: 'six_pack', ...adultMale });
    const fatLoss = calorieTarget({ tdee: 2800, goal: 'fat_loss', ...adultMale });
    expect(sixPack.target).toBe(fatLoss.target);
  });

  it('puts a lean bulk 250-350 over maintenance', () => {
    const result = calorieTarget({ tdee: 2800, goal: 'lean_bulk', ...adultMale });
    expect(result.min).toBe(3050);
    expect(result.max).toBe(3150);
    expect(result.target).toBe(3100);
  });

  it('sets recomp at maintenance minus 10%', () => {
    const result = calorieTarget({ tdee: 2800, goal: 'recomp', ...adultMale });
    expect(result.target).toBe(2520);
    expect(result.min).toBe(2520);
    expect(result.max).toBe(2520);
  });

  it('keeps discipline and spiritual at maintenance', () => {
    for (const goal of ['discipline', 'spiritual'] as const) {
      const result = calorieTarget({ tdee: 2400, goal, ...adultMale });
      expect(result.target).toBe(2400);
      expect(result.applied).toEqual([]);
    }
  });

  it('never returns a target under the sex floor', () => {
    const result = calorieTarget({
      tdee: 1400,
      goal: 'fat_loss',
      sex: 'female',
      age: 30,
      weightKg: 45,
    });
    expect(result.target).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
    expect(result.min).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
    expect(result.applied.length).toBeGreaterThan(0);
  });

  it('keeps the target inside its own clamped band', () => {
    const result = calorieTarget({
      tdee: 1600,
      goal: 'fat_loss',
      sex: 'female',
      age: 30,
      weightKg: 47,
    });
    expect(result.target).toBeGreaterThanOrEqual(result.min);
    expect(result.target).toBeLessThanOrEqual(result.max);
  });

  it('reports which guardrail moved the number', () => {
    const result = calorieTarget({
      tdee: 1500,
      goal: 'fat_loss',
      sex: 'female',
      age: 30,
      weightKg: 44,
    });
    expect(result.applied.join(' ')).toMatch(/floor|1%/);
  });

  it('limits an under-18 cut to 250 kcal', () => {
    const result = calorieTarget({
      tdee: 2600,
      goal: 'fat_loss',
      sex: 'male',
      age: 16,
      weightKg: 70,
    });
    expect(result.target).toBeGreaterThanOrEqual(2350);
    expect(result.applied.join(' ')).toContain('250');
  });
});

describe('macroTargets', () => {
  it('sets protein and fat per kg and gives carbs the remainder', () => {
    const result = macroTargets({ calories: 2400, weightKg: 80, goal: 'fat_loss' });
    expect(result.proteinG).toBe(176); // 2.2 g/kg
    expect(result.fatG).toBe(64); // 0.8 g/kg
    expect(result.carbsG).toBe(Math.round((2400 - 176 * 4 - 64 * 9) / 4));
    expect(result.trimmed).toBe(false);
  });

  it('keeps protein between 1.6 and 2.2 g/kg for every goal', () => {
    const goals = ['fat_loss', 'six_pack', 'recomp', 'lean_bulk', 'discipline', 'spiritual'] as const;
    for (const goal of goals) {
      const { proteinG } = macroTargets({ calories: 2600, weightKg: 70, goal });
      expect(proteinG / 70).toBeGreaterThanOrEqual(1.6);
      expect(proteinG / 70).toBeLessThanOrEqual(2.2);
    }
  });

  it('keeps fat at or above 0.6 g/kg', () => {
    const { fatG } = macroTargets({ calories: 1500, weightKg: 80, goal: 'fat_loss' });
    expect(fatG / 80).toBeGreaterThanOrEqual(0.6);
  });

  it('roughly reconciles macros back to the calorie budget', () => {
    const calories = 2400;
    const m = macroTargets({ calories, weightKg: 80, goal: 'recomp' });
    const total = m.proteinG * KCAL_PER_G.protein + m.carbsG * KCAL_PER_G.carbs + m.fatG * KCAL_PER_G.fat;
    expect(Math.abs(total - calories)).toBeLessThanOrEqual(5);
  });

  it('never produces negative carbs on a tight budget', () => {
    const result = macroTargets({ calories: 1200, weightKg: 95, goal: 'fat_loss' });
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
    expect(result.trimmed).toBe(true);
  });

  it('spends the whole budget without trimming when it lands exactly', () => {
    // 100 kg fat loss: 220 g protein (880) + 80 g fat (720) = 1600 exactly.
    const result = macroTargets({ calories: 1600, weightKg: 100, goal: 'fat_loss' });
    expect(result.trimmed).toBe(false);
    expect(result.carbsG).toBe(0);
  });

  it('trims fat to its floor before touching protein', () => {
    // 1500 kcal leaves protein + fat 100 kcal over budget.
    const result = macroTargets({ calories: 1500, weightKg: 100, goal: 'fat_loss' });
    expect(result.fatG).toBe(60);
    expect(result.proteinG).toBe(220);
    expect(result.trimmed).toBe(true);
  });
});

describe('waterTargetMl', () => {
  it('uses 35 ml per kg', () => {
    expect(waterTargetMl(80)).toBe(2800);
    expect(waterTargetMl(100)).toBe(3500);
  });

  it('never drops below 2.5 L', () => {
    expect(waterTargetMl(50)).toBe(2500);
    expect(waterTargetMl(40)).toBe(2500);
  });

  it('rounds to the nearest 100 ml', () => {
    expect(waterTargetMl(77) % 100).toBe(0);
  });
});
