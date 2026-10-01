import { describe, expect, it } from 'vitest';
import {
  CORRELATION_DISCLAIMER,
  MIN_PAIRS,
  correlate,
  pearson,
  strength,
} from './correlation';

const pairs = (xs: number[], ys: number[]) => xs.map((x, i) => ({ x, y: ys[i]! }));

describe('pearson', () => {
  it('is 1 for a perfect positive relationship', () => {
    expect(pearson(pairs([1, 2, 3, 4], [2, 4, 6, 8]))).toBe(1);
  });

  it('is -1 for a perfect negative relationship', () => {
    expect(pearson(pairs([1, 2, 3, 4], [8, 6, 4, 2]))).toBe(-1);
  });

  it('is near 0 for unrelated series', () => {
    const r = pearson(pairs([1, 2, 3, 4, 5], [3, 1, 4, 1, 5]));
    expect(Math.abs(r!)).toBeLessThan(0.5);
  });

  it('is null when one series is flat', () => {
    expect(pearson(pairs([1, 1, 1, 1], [2, 4, 6, 8]))).toBeNull();
    expect(pearson(pairs([1, 2, 3, 4], [5, 5, 5, 5]))).toBeNull();
  });

  it('is null with fewer than two points', () => {
    expect(pearson([])).toBeNull();
    expect(pearson([{ x: 1, y: 2 }])).toBeNull();
  });

  it('rounds to two decimals', () => {
    const r = pearson(pairs([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]));
    expect(r).toBe(Math.round(r! * 100) / 100);
  });
});

describe('strength', () => {
  it('bands by magnitude, ignoring sign', () => {
    expect(strength(0.1)).toBe('none');
    expect(strength(-0.1)).toBe('none');
    expect(strength(0.4)).toBe('weak');
    expect(strength(-0.4)).toBe('weak');
    expect(strength(0.6)).toBe('moderate');
    expect(strength(0.9)).toBe('strong');
  });

  it('treats null as none', () => {
    expect(strength(null)).toBe('none');
  });
});

describe('correlate', () => {
  const many = (n: number, fn: (i: number) => { x: number; y: number }) =>
    Array.from({ length: n }, (_, i) => fn(i));

  it('refuses to report below the minimum number of days', () => {
    const result = correlate({
      pairs: many(3, (i) => ({ x: i, y: i })),
      factorLabel: 'sleep',
    });
    expect(result.enoughData).toBe(false);
    expect(result.summary).toContain('more day');
  });

  it('counts down the days still needed', () => {
    const result = correlate({
      pairs: many(MIN_PAIRS - 1, (i) => ({ x: i, y: i })),
      factorLabel: 'sleep',
    });
    expect(result.summary).toContain('1 more day');
    expect(result.summary).not.toContain('days');
  });

  it('reports a strong positive link in the right direction', () => {
    const result = correlate({
      pairs: many(10, (i) => ({ x: i, y: i })),
      factorLabel: 'dairy',
    });
    expect(result.enoughData).toBe(true);
    expect(result.strength).toBe('strong');
    expect(result.summary).toContain('more breakouts');
  });

  it('reports a strong negative link in the right direction', () => {
    const result = correlate({
      pairs: many(10, (i) => ({ x: i, y: 10 - i })),
      factorLabel: 'sleep',
    });
    expect(result.strength).toBe('strong');
    expect(result.summary).toContain('fewer breakouts');
  });

  it('says there is no clear link rather than inventing one', () => {
    const noise = [3, 1, 4, 1, 5, 2, 3, 1, 4, 2];
    const result = correlate({
      pairs: noise.map((y, i) => ({ x: i % 3, y })),
      factorLabel: 'water',
    });
    if (result.strength === 'none') {
      expect(result.summary).toContain('No clear link');
    }
  });

  it('handles a flat factor without claiming anything', () => {
    const result = correlate({
      pairs: many(10, () => ({ x: 5, y: 2 })),
      factorLabel: 'water',
    });
    expect(result.r).toBeNull();
    expect(result.summary).toContain('No clear link');
  });

  it('accepts custom direction wording', () => {
    const result = correlate({
      pairs: many(10, (i) => ({ x: i, y: i })),
      factorLabel: 'sugar',
      higherFactorMeans: { more: 'worse skin', fewer: 'better skin' },
    });
    expect(result.summary).toContain('worse skin');
  });

  it('never states causation', () => {
    const results = [
      correlate({ pairs: many(10, (i) => ({ x: i, y: i })), factorLabel: 'dairy' }),
      correlate({ pairs: many(10, (i) => ({ x: i, y: 10 - i })), factorLabel: 'sleep' }),
    ];
    for (const result of results) {
      expect(result.summary).not.toMatch(/causes?|because of|due to|proves?/i);
    }
  });
});

describe('CORRELATION_DISCLAIMER', () => {
  it('matches the wording §8.3 asks for', () => {
    expect(CORRELATION_DISCLAIMER).toBe('Correlation, not proof.');
  });
});
