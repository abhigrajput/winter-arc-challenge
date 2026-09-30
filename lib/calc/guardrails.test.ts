import { describe, expect, it } from 'vitest';
import {
  CALORIE_FLOOR,
  bmi,
  checkTargetWeight,
  clampCalories,
  isMinor,
  maxDailyDeficit,
  minHealthyWeightKg,
} from './guardrails';

describe('bmi', () => {
  it('computes kg over metres squared', () => {
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
  });
});

describe('minHealthyWeightKg', () => {
  it('returns the weight at BMI 18.5', () => {
    expect(minHealthyWeightKg(180)).toBeCloseTo(59.94, 2);
    expect(bmi(minHealthyWeightKg(165), 165)).toBeCloseTo(18.5, 6);
  });
});

describe('checkTargetWeight', () => {
  it('allows a target at or above BMI 18.5', () => {
    expect(checkTargetWeight(70, 180).ok).toBe(true);
    expect(checkTargetWeight(60, 180).ok).toBe(true);
  });

  it('blocks a target under BMI 18.5 and names the floor', () => {
    const result = checkTargetWeight(52, 180);
    expect(result.ok).toBe(false);
    expect(result.minWeightKg).toBe(59.9);
    expect(result.message).toContain('59.9 kg');
    expect(result.message).toContain('doctor');
  });

  it('keeps the refusal neutral — no shame, no praise', () => {
    const { message } = checkTargetWeight(45, 180);
    expect(message).not.toMatch(/earn|lazy|too fat|too thin|should be ashamed/i);
  });
});

describe('maxDailyDeficit', () => {
  it('caps weekly loss at 1% of bodyweight', () => {
    // 80 kg -> 0.8 kg/week -> 6160 kcal/week -> 880 kcal/day
    expect(maxDailyDeficit(80)).toBeCloseTo(880, 6);
  });
});

describe('isMinor', () => {
  it('splits at 18', () => {
    expect(isMinor(17)).toBe(true);
    expect(isMinor(18)).toBe(false);
  });
});

describe('clampCalories', () => {
  const adultMale = { maintenance: 2600, sex: 'male' as const, age: 25, weightKg: 80 };

  it('leaves a sane number untouched', () => {
    const result = clampCalories({ ...adultMale, calories: 2200 });
    expect(result.calories).toBe(2200);
    expect(result.applied).toEqual([]);
  });

  it('enforces the male floor of 1500', () => {
    const result = clampCalories({
      calories: 900,
      maintenance: 1700,
      sex: 'male',
      age: 30,
      weightKg: 55,
    });
    expect(result.calories).toBe(CALORIE_FLOOR.male);
    expect(result.applied.join(' ')).toContain('1500');
  });

  it('enforces the female floor of 1200', () => {
    const result = clampCalories({
      calories: 800,
      maintenance: 1500,
      sex: 'female',
      age: 30,
      weightKg: 48,
    });
    expect(result.calories).toBe(CALORIE_FLOOR.female);
  });

  it('caps the deficit at 1% of bodyweight per week', () => {
    // 80 kg -> max 880 kcal/day deficit -> floor of 1720 from a 2600 maintenance
    const result = clampCalories({ ...adultMale, calories: 1200 });
    expect(result.calories).toBe(1720);
    expect(result.applied.join(' ')).toContain('1%');
  });

  it('limits an under-18 to a 250 kcal swing either way', () => {
    const cut = clampCalories({
      calories: 1600,
      maintenance: 2400,
      sex: 'male',
      age: 16,
      weightKg: 65,
    });
    expect(cut.calories).toBe(2150);
    expect(cut.applied.join(' ')).toContain('250');

    const surplus = clampCalories({
      calories: 3000,
      maintenance: 2400,
      sex: 'male',
      age: 16,
      weightKg: 65,
    });
    expect(surplus.calories).toBe(2650);
  });

  it('does not cap an adult surplus', () => {
    const result = clampCalories({ ...adultMale, calories: 3000 });
    expect(result.calories).toBe(3000);
    expect(result.applied).toEqual([]);
  });

  it('lets the absolute floor win over the other caps', () => {
    const result = clampCalories({
      calories: 500,
      maintenance: 1400,
      sex: 'female',
      age: 16,
      weightKg: 45,
    });
    expect(result.calories).toBeGreaterThanOrEqual(CALORIE_FLOOR.female);
  });
});
