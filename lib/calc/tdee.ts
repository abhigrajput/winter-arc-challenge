import type { Sex } from '@/lib/supabase/types';

/**
 * Activity multipliers applied to BMR. The numeric value is what lives in
 * profiles.activity_level, so these are the only values ever stored.
 */
export const ACTIVITY_LEVELS = [
  {
    value: 1.2,
    slug: 'sedentary',
    label: 'Sedentary',
    description: 'Desk work, little movement',
  },
  {
    value: 1.375,
    slug: 'light',
    label: 'Light',
    description: 'Light exercise 1-3 days/week',
  },
  {
    value: 1.55,
    slug: 'moderate',
    label: 'Moderate',
    description: 'Training 3-5 days/week',
  },
  {
    value: 1.725,
    slug: 'very_active',
    label: 'Very active',
    description: 'Hard training 6-7 days/week, or physical job',
  },
] as const;

export type ActivityValue = (typeof ACTIVITY_LEVELS)[number]['value'];

export const ACTIVITY_VALUES = ACTIVITY_LEVELS.map((a) => a.value) as readonly number[];

export function isActivityValue(value: number): value is ActivityValue {
  return ACTIVITY_VALUES.includes(value);
}

export interface BmrInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

/**
 * Mifflin-St Jeor resting metabolic rate, kcal/day.
 * Men:   10w + 6.25h - 5a + 5
 * Women: 10w + 6.25h - 5a - 161
 */
export function bmr({ sex, age, heightCm, weightKg }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(base + (sex === 'male' ? 5 : -161));
}

/** Total daily energy expenditure, kcal/day. */
export function tdee(input: BmrInput, activityLevel: number): number {
  return Math.round(bmr(input) * activityLevel);
}
