import { describe, expect, it } from 'vitest';
import { navyBodyFat } from './bodyfat';
import { BODY_FAT_FIXTURES } from './bodyfat-fixtures';

/**
 * Pins the TypeScript side of the §6 body fat estimate.
 *
 * The same fixtures are pushed through the live compute_navy_body_fat()
 * trigger by scripts/verify-body-fat-trigger.mts. Anything that changes these
 * numbers has to change the trigger in
 * supabase/migrations/pre-phase-13.sql too.
 */
describe('navyBodyFat parity fixtures', () => {
  for (const fixture of BODY_FAT_FIXTURES) {
    it(fixture.label, () => {
      expect(navyBodyFat(fixture)).toBe(fixture.expected);
    });
  }

  it('covers both sexes and both refusal reasons', () => {
    expect(BODY_FAT_FIXTURES.some((f) => f.sex === 'male')).toBe(true);
    expect(BODY_FAT_FIXTURES.some((f) => f.sex === 'female')).toBe(true);
    expect(BODY_FAT_FIXTURES.filter((f) => f.expected === null).length).toBeGreaterThanOrEqual(3);
  });

  it('rounds to one decimal, never more', () => {
    for (const fixture of BODY_FAT_FIXTURES) {
      if (fixture.expected === null) continue;
      expect(Math.round(fixture.expected * 10)).toBe(fixture.expected * 10);
    }
  });
});
