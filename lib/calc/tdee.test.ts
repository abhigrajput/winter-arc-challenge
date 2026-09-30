import { describe, expect, it } from 'vitest';
import { ACTIVITY_LEVELS, bmr, isActivityValue, tdee } from './tdee';

describe('bmr (Mifflin-St Jeor)', () => {
  it('matches the worked male example', () => {
    // 10(80) + 6.25(180) - 5(25) + 5 = 800 + 1125 - 125 + 5 = 1805
    expect(bmr({ sex: 'male', age: 25, heightCm: 180, weightKg: 80 })).toBe(1805);
  });

  it('matches the worked female example', () => {
    // 10(60) + 6.25(165) - 5(30) - 161 = 600 + 1031.25 - 150 - 161 = 1320.25
    expect(bmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBe(1320);
  });

  it('separates the sexes by exactly 166 kcal at identical stats', () => {
    const stats = { age: 25, heightCm: 175, weightKg: 70 };
    const male = bmr({ ...stats, sex: 'male' });
    const female = bmr({ ...stats, sex: 'female' });
    expect(male - female).toBe(166);
  });

  it('falls as age rises and climbs with mass', () => {
    const base = { sex: 'male' as const, age: 25, heightCm: 180, weightKg: 80 };
    expect(bmr({ ...base, age: 45 })).toBeLessThan(bmr(base));
    expect(bmr({ ...base, weightKg: 90 })).toBeGreaterThan(bmr(base));
  });
});

describe('tdee', () => {
  it('multiplies bmr by the activity level', () => {
    const input = { sex: 'male' as const, age: 25, heightCm: 180, weightKg: 80 };
    expect(tdee(input, 1.55)).toBe(Math.round(1805 * 1.55));
  });

  it('rises monotonically across the activity levels', () => {
    const input = { sex: 'female' as const, age: 28, heightCm: 165, weightKg: 62 };
    const values = ACTIVITY_LEVELS.map((level) => tdee(input, level.value));
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('ACTIVITY_LEVELS', () => {
  it('exposes exactly the four multipliers from the spec', () => {
    expect(ACTIVITY_LEVELS.map((a) => a.value)).toEqual([1.2, 1.375, 1.55, 1.725]);
  });

  it('recognises only those multipliers', () => {
    expect(isActivityValue(1.55)).toBe(true);
    expect(isActivityValue(1.9)).toBe(false);
  });
});
