import type { NavyInput } from './bodyfat';

/**
 * Fixtures shared by the unit test and the live trigger verifier.
 *
 * §6's body fat estimate is computed in two places: navyBodyFat() here, and
 * the compute_navy_body_fat() trigger added in
 * supabase/migrations/pre-phase-13.sql. They have to agree, or the number on
 * /body changes depending on who wrote the row. These cases are the contract
 * between them — scripts/verify-body-fat-trigger.mts pushes each one through
 * the live database and compares.
 *
 * `expected` is null where no honest estimate exists (waist not bigger than
 * neck, hip missing for a woman).
 */

export interface BodyFatFixture extends NavyInput {
  label: string;
  expected: number | null;
}

export const BODY_FAT_FIXTURES: BodyFatFixture[] = [
  // Men, across the range the app actually sees.
  { label: 'man, lean', sex: 'male', heightCm: 178, waistCm: 76, neckCm: 38, expected: 8.8 },
  { label: 'man, average', sex: 'male', heightCm: 175, waistCm: 88, neckCm: 38, expected: 19.2 },
  { label: 'man, heavier', sex: 'male', heightCm: 170, waistCm: 104, neckCm: 41, expected: 28.8 },
  { label: 'man, tall', sex: 'male', heightCm: 193, waistCm: 90, neckCm: 40, expected: 16.3 },
  { label: 'man, short', sex: 'male', heightCm: 158, waistCm: 80, neckCm: 36, expected: 17.6 },

  // Women use waist + hip - neck and their own constants.
  { label: 'woman, lean', sex: 'female', heightCm: 165, waistCm: 68, neckCm: 31, hipCm: 90, expected: 21.7 },
  { label: 'woman, average', sex: 'female', heightCm: 162, waistCm: 76, neckCm: 32, hipCm: 98, expected: 30.3 },
  { label: 'woman, heavier', sex: 'female', heightCm: 158, waistCm: 92, neckCm: 34, hipCm: 108, expected: 42.7 },

  // Boundaries and refusals.
  { label: 'man, waist equals neck', sex: 'male', heightCm: 175, waistCm: 38, neckCm: 38, expected: null },
  { label: 'man, waist under neck', sex: 'male', heightCm: 175, waistCm: 36, neckCm: 40, expected: null },
  { label: 'woman, no hip', sex: 'female', heightCm: 165, waistCm: 68, neckCm: 31, expected: null },
  { label: 'man, one decimal of waist', sex: 'male', heightCm: 175.5, waistCm: 88.5, neckCm: 38.5, expected: 19.1 },
];
