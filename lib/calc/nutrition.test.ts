import { describe, expect, it } from 'vitest';
import { CALORIE_BAND, caloriesInRange, ring, sumEntries, toLitres } from './nutrition';

const entry = (calories: number, protein = 0, carbs = 0, fat = 0) => ({
  calories,
  protein_g: protein,
  carbs_g: carbs,
  fat_g: fat,
});

describe('sumEntries', () => {
  it('adds every macro', () => {
    const totals = sumEntries([entry(300, 20, 30, 10), entry(500, 40, 50, 15)]);
    expect(totals).toEqual({ calories: 800, proteinG: 60, carbsG: 80, fatG: 25 });
  });

  it('is zero for an empty day', () => {
    expect(sumEntries([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('treats missing macros as zero', () => {
    const totals = sumEntries([
      { calories: 200, protein_g: null, carbs_g: null, fat_g: null },
    ]);
    expect(totals).toEqual({ calories: 200, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it('rounds fractional macros once, at the end', () => {
    const totals = sumEntries([entry(100, 10.4), entry(100, 10.4)]);
    expect(totals.proteinG).toBe(21);
  });
});

describe('ring', () => {
  it('reports progress toward the target', () => {
    const r = ring(1200, 2400);
    expect(r.percent).toBe(50);
    expect(r.remaining).toBe(1200);
    expect(r.hit).toBe(false);
  });

  it('caps the arc at 100 but keeps remaining signed', () => {
    const r = ring(3000, 2400);
    expect(r.percent).toBe(100);
    expect(r.remaining).toBe(-600);
    expect(r.over).toBe(true);
  });

  it('counts exactly hitting the target as hit, not over', () => {
    const r = ring(2400, 2400);
    expect(r.hit).toBe(true);
    expect(r.over).toBe(false);
  });

  it('reads as empty rather than NaN with no target', () => {
    for (const target of [0, null, undefined]) {
      const r = ring(500, target);
      expect(r.percent).toBe(0);
      expect(r.hit).toBe(false);
    }
  });

  it('is 0% on an untouched day', () => {
    expect(ring(0, 2400).percent).toBe(0);
  });
});

describe('caloriesInRange', () => {
  it('accepts anything inside the band', () => {
    expect(caloriesInRange(2400, 2400)).toBe(true);
    expect(caloriesInRange(2320, 2400)).toBe(true);
    expect(caloriesInRange(2480, 2400)).toBe(true);
  });

  it('rejects outside the band in either direction', () => {
    expect(caloriesInRange(2200, 2400)).toBe(false);
    expect(caloriesInRange(2600, 2400)).toBe(false);
  });

  it('treats the band edges as inside', () => {
    expect(caloriesInRange(2400 - CALORIE_BAND, 2400)).toBe(true);
    expect(caloriesInRange(2400 + CALORIE_BAND, 2400)).toBe(true);
  });

  it('is false without a target', () => {
    expect(caloriesInRange(2000, null)).toBe(false);
    expect(caloriesInRange(2000, 0)).toBe(false);
  });

  it('accepts a custom band', () => {
    expect(caloriesInRange(2300, 2400, 200)).toBe(true);
  });
});

describe('toLitres', () => {
  it('converts and rounds to one decimal', () => {
    expect(toLitres(2500)).toBe(2.5);
    expect(toLitres(3000)).toBe(3);
    expect(toLitres(1250)).toBe(1.3);
  });

  it('handles zero', () => {
    expect(toLitres(0)).toBe(0);
  });
});
