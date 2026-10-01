import { describe, expect, it } from 'vitest';
import {
  BARBELL_INCREMENT_KG,
  bestEstimated1RM,
  bestReps,
  detectPr,
  epley1RM,
  sessionVolume,
  suggestOverload,
} from './progression';

const set = (reps: number, weight = 0) => ({ reps, weight_kg: weight });

describe('epley1RM', () => {
  it('returns the weight itself for a single', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  it('applies the Epley formula', () => {
    // 100 * (1 + 5/30) = 116.67
    expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1);
    expect(epley1RM(80, 10)).toBeCloseTo(106.7, 1);
  });

  it('is 0 for non-positive input', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(-50, 5)).toBe(0);
  });

  it('rises with both weight and reps', () => {
    expect(epley1RM(105, 5)).toBeGreaterThan(epley1RM(100, 5));
    expect(epley1RM(100, 6)).toBeGreaterThan(epley1RM(100, 5));
  });
});

describe('bestEstimated1RM', () => {
  it('takes the best set, not the last or the heaviest', () => {
    // 100x5 = 116.7, 90x8 = 114.0, 105x3 = 115.5 — the first set wins.
    const sets = [set(5, 100), set(8, 90), set(3, 105)];
    expect(bestEstimated1RM(sets)).toBeCloseTo(epley1RM(100, 5), 1);
  });

  it('is 0 for bodyweight-only sets', () => {
    expect(bestEstimated1RM([set(20), set(15)])).toBe(0);
  });

  it('is 0 for an empty session', () => {
    expect(bestEstimated1RM([])).toBe(0);
  });
});

describe('bestReps', () => {
  it('takes the highest single set', () => {
    expect(bestReps([set(8), set(12), set(10)])).toBe(12);
  });

  it('is 0 with nothing logged', () => {
    expect(bestReps([])).toBe(0);
    expect(bestReps([{ reps: null, weight_kg: null }])).toBe(0);
  });
});

describe('sessionVolume', () => {
  it('sums weight times reps', () => {
    expect(sessionVolume([set(10, 60), set(8, 60)])).toBe(600 + 480);
  });

  it('counts bodyweight sets as no external load', () => {
    expect(sessionVolume([set(20), set(15)])).toBe(0);
  });
});

describe('detectPr', () => {
  it('flags a heavier estimated 1RM', () => {
    const result = detectPr([set(5, 100)], 110, false);
    expect(result.isPr).toBe(true);
    expect(result.metric).toBe('estimated_1rm');
  });

  it('does not flag a weaker session', () => {
    expect(detectPr([set(5, 90)], 120, false).isPr).toBe(false);
  });

  it('does not flag matching the previous best', () => {
    const previous = epley1RM(100, 5);
    expect(detectPr([set(5, 100)], previous, false).isPr).toBe(false);
  });

  it('uses reps for bodyweight lifts', () => {
    const result = detectPr([set(12)], 10, true);
    expect(result.isPr).toBe(true);
    expect(result.metric).toBe('reps');
    expect(result.current).toBe(12);
  });

  it('treats a first-ever set as a PR', () => {
    expect(detectPr([set(8)], 0, true).isPr).toBe(true);
    expect(detectPr([set(5, 60)], 0, false).isPr).toBe(true);
  });

  it('is not a PR when nothing was logged', () => {
    const result = detectPr([], 0, true);
    expect(result.isPr).toBe(false);
    expect(result.metric).toBeNull();
  });
});

describe('suggestOverload', () => {
  it('adds 2.5 kg when every set hit the top of the range', () => {
    const result = suggestOverload({
      sets: [set(8, 60), set(8, 60), set(8, 60)],
      repRangeTop: 8,
      isBodyweight: false,
    });
    expect(result.earned).toBe(true);
    expect(result.nextWeightKg).toBe(60 + BARBELL_INCREMENT_KG);
    expect(result.advice).toContain('62.5');
  });

  it('holds the load when one set fell short', () => {
    const result = suggestOverload({
      sets: [set(8, 60), set(7, 60), set(8, 60)],
      repRangeTop: 8,
      isBodyweight: false,
    });
    expect(result.earned).toBe(false);
    expect(result.nextWeightKg).toBeNull();
    expect(result.advice).toContain('8 reps');
  });

  it('bases the jump on the heaviest set', () => {
    const result = suggestOverload({
      sets: [set(8, 50), set(8, 60)],
      repRangeTop: 8,
      isBodyweight: false,
    });
    expect(result.nextWeightKg).toBe(62.5);
  });

  it('points bodyweight work at the next progression', () => {
    const result = suggestOverload({
      sets: [set(12), set(12)],
      repRangeTop: 12,
      isBodyweight: true,
      nextProgressionName: 'Diamond push-up',
    });
    expect(result.earned).toBe(true);
    expect(result.nextWeightKg).toBeNull();
    expect(result.advice).toContain('Diamond push-up');
  });

  it('says so when there is no harder progression left', () => {
    const result = suggestOverload({
      sets: [set(12)],
      repRangeTop: 12,
      isBodyweight: true,
      nextProgressionName: null,
    });
    expect(result.earned).toBe(true);
    expect(result.advice).toContain('top of this progression');
  });

  it('asks for a set when the session is empty', () => {
    const result = suggestOverload({ sets: [], repRangeTop: 8, isBodyweight: false });
    expect(result.earned).toBe(false);
    expect(result.advice).toContain('Log a set');
  });

  it('ignores empty sets when judging the range', () => {
    const result = suggestOverload({
      sets: [set(8, 60), { reps: null, weight_kg: null }],
      repRangeTop: 8,
      isBodyweight: false,
    });
    expect(result.earned).toBe(true);
  });

  it('accepts a custom increment for dumbbells', () => {
    const result = suggestOverload({
      sets: [set(10, 20)],
      repRangeTop: 10,
      isBodyweight: false,
      incrementKg: 2,
    });
    expect(result.nextWeightKg).toBe(22);
  });
});
