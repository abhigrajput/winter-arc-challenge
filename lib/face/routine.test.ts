import { describe, expect, it } from 'vitest';
import {
  AM_ROUTINE,
  DERM_REFERRAL,
  JAWLINE_DRILLS,
  JAWLINE_NOT_RECOMMENDED,
  JAWLINE_TRUTH,
  OTC_ACTIVES,
  PM_ROUTINE,
  needsDermReferral,
} from './routine';

const allText = [
  ...AM_ROUTINE.flatMap((s) => [s.product, s.instruction]),
  ...PM_ROUTINE.flatMap((s) => [s.product, s.instruction]),
  ...OTC_ACTIVES.flatMap((a) => [a.name, a.bestFor, a.startAt, a.caution]),
  ...JAWLINE_TRUTH,
  ...JAWLINE_DRILLS.flatMap((d) => [d.name, d.dose, d.cue]),
  DERM_REFERRAL,
].join(' ');

describe('AM routine (§8.3)', () => {
  it('has cleanser, moisturiser and sunscreen', () => {
    const slugs = AM_ROUTINE.map((s) => s.slug);
    expect(slugs).toEqual(['am_cleanser', 'am_moisturiser', 'am_spf']);
  });

  it('specifies SPF 30 or higher', () => {
    const spf = AM_ROUTINE.find((s) => s.slug === 'am_spf')!;
    expect(spf.product).toMatch(/SPF\s*30\+?/i);
  });

  it('treats every morning step as essential', () => {
    expect(AM_ROUTINE.every((s) => s.essential)).toBe(true);
  });
});

describe('PM routine (§8.3)', () => {
  it('offers at most one optional active', () => {
    const optional = PM_ROUTINE.filter((s) => !s.essential);
    expect(optional).toHaveLength(1);
    expect(optional[0]!.slug).toBe('pm_active');
  });

  it('keeps moisturiser after the active', () => {
    const slugs = PM_ROUTINE.map((s) => s.slug);
    expect(slugs.indexOf('pm_moisturiser')).toBeGreaterThan(slugs.indexOf('pm_active'));
  });
});

describe('OTC actives (§8.3)', () => {
  it('lists only the four allowed actives', () => {
    expect(OTC_ACTIVES.map((a) => a.slug).sort()).toEqual([
      'adapalene',
      'benzoyl_peroxide',
      'niacinamide',
      'salicylic_acid',
    ]);
  });

  it('never names a prescription-only medication', () => {
    expect(allText).not.toMatch(
      /\b(isotretinoin|accutane|tretinoin|retin-?a|spironolactone|doxycycline|minocycline|antibiotic|hydroquinone)\b/i,
    );
  });

  it('gives every active a starting dose and a caution', () => {
    for (const active of OTC_ACTIVES) {
      expect(active.startAt.length, active.slug).toBeGreaterThan(0);
      expect(active.caution.length, active.slug).toBeGreaterThan(0);
    }
  });
});

describe('needsDermReferral (§8.3)', () => {
  it('flags sustained severe breakouts', () => {
    expect(needsDermReferral({ recentScores: [5, 4, 5, 4, 5], notes: '' })).toBe(true);
  });

  it('does not flag an occasional bad day', () => {
    expect(needsDermReferral({ recentScores: [1, 0, 5, 1, 0], notes: '' })).toBe(false);
  });

  it('flags cystic or scarring language in the notes', () => {
    expect(needsDermReferral({ recentScores: [1], notes: 'painful cystic spots' })).toBe(true);
    expect(needsDermReferral({ recentScores: [1], notes: 'left a scar' })).toBe(true);
    expect(needsDermReferral({ recentScores: [1], notes: 'nodules on the jaw' })).toBe(true);
  });

  it('stays quiet on ordinary notes', () => {
    expect(needsDermReferral({ recentScores: [1, 2], notes: 'a bit oily today' })).toBe(false);
  });

  it('needs enough days before judging severity', () => {
    expect(needsDermReferral({ recentScores: [5, 5], notes: '' })).toBe(false);
  });

  it('sends the user to a dermatologist, not to a drug', () => {
    expect(DERM_REFERRAL).toMatch(/dermatologist/i);
    expect(DERM_REFERRAL).not.toMatch(/isotretinoin|accutane|antibiotic/i);
  });
});

describe('jawline content (§8.4)', () => {
  it('states that body fat drives it and cannot be spot-reduced', () => {
    const text = JAWLINE_TRUTH.join(' ');
    expect(text).toMatch(/facial fat|body fat/i);
    expect(text).toMatch(/spot-reduce/i);
  });

  it('states that bone structure is fixed', () => {
    expect(JAWLINE_TRUTH.join(' ')).toMatch(/bone structure is genetic and fixed/i);
  });

  it('never promotes jaw devices, mewing or bone change', () => {
    expect(allText).not.toMatch(/\btry mewing|use a jaw exerciser|reshape your jaw\b/i);
  });

  it('names what it will not recommend, and why', () => {
    const text = JAWLINE_NOT_RECOMMENDED.join(' ');
    expect(text).toMatch(/jaw exerciser/i);
    expect(text).toMatch(/TMJ/i);
    expect(text).toMatch(/mewing/i);
  });

  it('keeps neck work light and progressive', () => {
    expect(JAWLINE_DRILLS.map((d) => d.slug)).toEqual([
      'chin_tuck',
      'wall_angel',
      'neck_curl',
      'neck_extension',
    ]);
    const neckCurl = JAWLINE_DRILLS.find((d) => d.slug === 'neck_curl')!;
    expect(neckCurl.cue).toMatch(/no added load/i);
  });
});

describe('tone', () => {
  it('never shames the reader (§10)', () => {
    expect(allText).not.toMatch(/\b(lazy|disgusting|ugly|gross|ashamed)\b/i);
  });
});
