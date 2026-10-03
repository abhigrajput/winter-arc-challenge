import { describe, expect, it } from 'vitest';
import { normalizeDecimal, parseDecimal } from './decimal';

describe('normalizeDecimal', () => {
  it('turns a comma into a dot and trims', () => {
    expect(normalizeDecimal(' 2,5 ')).toBe('2.5');
    expect(normalizeDecimal('80.5')).toBe('80.5');
  });

  it('reads blank and missing as undefined', () => {
    expect(normalizeDecimal('')).toBeUndefined();
    expect(normalizeDecimal('   ')).toBeUndefined();
    expect(normalizeDecimal(null)).toBeUndefined();
    expect(normalizeDecimal(undefined)).toBeUndefined();
  });

  it('passes numbers through untouched', () => {
    expect(normalizeDecimal(3)).toBe(3);
  });
});

describe('parseDecimal', () => {
  it.each([
    ['2,5', 2.5],
    ['2.5', 2.5],
    ['80', 80],
    [' 12,25 ', 12.25],
  ])('parses %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });

  it('returns NaN for blank or junk', () => {
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('abc')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });
});
