import { describe, expect, it } from 'vitest';
import { buildPlan, planToProfileTargets, type PlanInput } from './plan';
import { CALORIE_FLOOR } from './guardrails';

const input: PlanInput = {
  sex: 'male',
  age: 25,
  heightCm: 180,
  weightKg: 85,
  targetWeightKg: 75,
  activityLevel: 1.55,
  goal: 'fat_loss',
  waistCm: 90,
  neckCm: 39,
};

describe('buildPlan', () => {
  it('produces every number the result screen needs', () => {
    const plan = buildPlan(input);
    expect(plan.bmr).toBeGreaterThan(1500);
    expect(plan.tdee).toBeGreaterThan(plan.bmr);
    expect(plan.calories.target).toBeLessThan(plan.tdee);
    expect(plan.macros.proteinG).toBeGreaterThan(0);
    expect(plan.waterMl).toBeGreaterThanOrEqual(2500);
    expect(plan.bodyFat).not.toBeNull();
    expect(plan.projection.lowKg).toBeLessThan(input.weightKg);
  });

  it('recovers the BMR that produced the TDEE', () => {
    const plan = buildPlan(input);
    expect(plan.bmr).toBe(Math.round(plan.tdee / input.activityLevel));
  });

  it('omits body fat when measurements are missing', () => {
    expect(buildPlan({ ...input, waistCm: null, neckCm: null }).bodyFat).toBeNull();
    expect(buildPlan({ ...input, neckCm: null }).bodyFat).toBeNull();
  });

  it('omits body fat for a woman with no hip measurement', () => {
    const plan = buildPlan({ ...input, sex: 'female', waistCm: 75, neckCm: 32, hipCm: null });
    expect(plan.bodyFat).toBeNull();
  });

  it('includes body fat for a woman with a hip measurement', () => {
    const plan = buildPlan({ ...input, sex: 'female', waistCm: 75, neckCm: 32, hipCm: 98 });
    expect(plan.bodyFat).not.toBeNull();
    expect(plan.bodyFat!.low).toBeLessThan(plan.bodyFat!.estimate);
    expect(plan.bodyFat!.high).toBeGreaterThan(plan.bodyFat!.estimate);
  });

  it('respects the calorie floor for a small, sedentary user', () => {
    const plan = buildPlan({
      ...input,
      sex: 'female',
      heightCm: 152,
      weightKg: 45,
      targetWeightKg: 43,
      activityLevel: 1.2,
    });
    expect(plan.calories.target).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
  });

  it('projects upward on a lean bulk', () => {
    const plan = buildPlan({ ...input, goal: 'lean_bulk', targetWeightKg: 90 });
    expect(plan.calories.target).toBeGreaterThan(plan.tdee);
    expect(plan.projection.highKg).toBeGreaterThan(input.weightKg);
  });

  it('holds maintenance for a discipline goal', () => {
    const plan = buildPlan({ ...input, goal: 'discipline' });
    expect(plan.calories.target).toBe(plan.tdee);
    expect(plan.projection.maintenance).toBe(true);
  });
});

describe('planToProfileTargets', () => {
  it('maps onto the live profiles columns', () => {
    const targets = planToProfileTargets(buildPlan(input));
    expect(Object.keys(targets).sort()).toEqual([
      'calorie_target',
      'carbs_target_g',
      'fat_target_g',
      'protein_target_g',
      'water_target_ml',
    ]);
    for (const value of Object.values(targets)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
