import type { Sex } from '@/lib/supabase/types';

/**
 * US Navy body fat estimate. §6.
 * This is a tape-measure estimate, not a scan: treat it as +/- 3-4 percentage
 * points and only trust the trend. Always label it as an estimate in the UI.
 */

export const BODY_FAT_ERROR_MARGIN = 4;

export interface NavyInput {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  /** Required for women, ignored for men. */
  hipCm?: number | null;
}

/**
 * Returns the estimate in percent, or null when the measurements cannot give
 * one (waist not bigger than neck, missing hip for women).
 */
export function navyBodyFat({ sex, heightCm, waistCm, neckCm, hipCm }: NavyInput): number | null {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;

  if (sex === 'male') {
    const girth = waistCm - neckCm;
    if (girth <= 0) return null;

    const value =
      495 / (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) - 450;
    return round1(value);
  }

  if (!hipCm || hipCm <= 0) return null;
  const girth = waistCm + hipCm - neckCm;
  if (girth <= 0) return null;

  const value =
    495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) - 450;
  return round1(value);
}

/** The estimate as a range, which is the only honest way to show it. */
export function bodyFatRange(estimate: number): { low: number; high: number } {
  return {
    low: round1(Math.max(0, estimate - BODY_FAT_ERROR_MARGIN)),
    high: round1(estimate + BODY_FAT_ERROR_MARGIN),
  };
}

/**
 * Body fat at which abs are typically visible (§8.2). Muscle still has to be
 * built underneath — this is the reveal point, not a guarantee.
 */
export const VISIBLE_ABS_BODY_FAT: Record<Sex, { low: number; high: number }> = {
  male: { low: 10, high: 13 },
  female: { low: 17, high: 21 },
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
