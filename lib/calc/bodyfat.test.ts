import { describe, expect, it } from 'vitest';
import { VISIBLE_ABS_BODY_FAT, bodyFatRange, navyBodyFat } from './bodyfat';

describe('navyBodyFat', () => {
  it('estimates for a man from waist, neck and height', () => {
    const result = navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 85, neckCm: 38 });
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(12);
    expect(result!).toBeLessThan(20);
  });

  it('estimates for a woman using the hip measurement', () => {
    const result = navyBodyFat({
      sex: 'female',
      heightCm: 165,
      waistCm: 72,
      neckCm: 32,
      hipCm: 95,
    });
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(20);
    expect(result!).toBeLessThan(35);
  });

  it('rises as the waist grows, all else equal', () => {
    const lean = navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 80, neckCm: 38 })!;
    const heavier = navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 95, neckCm: 38 })!;
    expect(heavier).toBeGreaterThan(lean);
  });

  it('returns null when a woman has no hip measurement', () => {
    expect(navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32 })).toBeNull();
    expect(
      navyBodyFat({ sex: 'female', heightCm: 165, waistCm: 72, neckCm: 32, hipCm: null }),
    ).toBeNull();
  });

  it('returns null rather than NaN when the waist is not bigger than the neck', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 38, neckCm: 38 })).toBeNull();
    expect(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 30, neckCm: 40 })).toBeNull();
  });

  it('returns null on non-positive measurements', () => {
    expect(navyBodyFat({ sex: 'male', heightCm: 0, waistCm: 85, neckCm: 38 })).toBeNull();
    expect(navyBodyFat({ sex: 'male', heightCm: 180, waistCm: 0, neckCm: 38 })).toBeNull();
  });

  it('rounds to one decimal place', () => {
    const result = navyBodyFat({ sex: 'male', heightCm: 178, waistCm: 88, neckCm: 39 })!;
    expect(result).toBe(Math.round(result * 10) / 10);
  });
});

describe('bodyFatRange', () => {
  it('spans 4 points either side of the estimate', () => {
    expect(bodyFatRange(18)).toEqual({ low: 14, high: 22 });
  });

  it('never goes below zero', () => {
    expect(bodyFatRange(2).low).toBe(0);
  });
});

describe('VISIBLE_ABS_BODY_FAT', () => {
  it('matches the bands in the spec', () => {
    expect(VISIBLE_ABS_BODY_FAT.male).toEqual({ low: 10, high: 13 });
    expect(VISIBLE_ABS_BODY_FAT.female).toEqual({ low: 17, high: 21 });
  });
});
