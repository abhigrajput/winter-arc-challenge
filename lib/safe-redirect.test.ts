import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-redirect';

describe('safeNext', () => {
  it('keeps same-origin paths', () => {
    expect(safeNext('/train')).toBe('/train');
    expect(safeNext('/body?tab=photos')).toBe('/body?tab=photos');
  });

  it('falls back on empty input', () => {
    expect(safeNext(undefined)).toBe('/today');
    expect(safeNext(null)).toBe('/today');
    expect(safeNext('')).toBe('/today');
  });

  it('rejects off-origin targets', () => {
    expect(safeNext('https://evil.test')).toBe('/today');
    expect(safeNext('//evil.test')).toBe('/today');
    expect(safeNext('/\\evil.test')).toBe('/today');
    expect(safeNext('javascript:alert(1)')).toBe('/today');
  });

  it('rejects control characters', () => {
    expect(safeNext('/today\nSet-Cookie: x=1')).toBe('/today');
  });

  it('honours a custom fallback', () => {
    expect(safeNext('https://evil.test', '/login')).toBe('/login');
  });
});
