import type { Sex } from '@/lib/supabase/types';

/**
 * Numeric safety rules from CLAUDE.md §10. Everything that decides a calorie
 * number passes through here, so the floors cannot be bypassed by a goal preset
 * or an AI suggestion. lib/ai/guardrails.ts reuses these for model output.
 */

/** Absolute calorie floors. Never go below these, whatever the goal says. */
export const CALORIE_FLOOR: Record<Sex, number> = { male: 1500, female: 1200 };

/** Fraction of bodyweight that may be lost per week. */
export const MAX_WEEKLY_LOSS_FRACTION = 0.01;

/** Under 18: only a mild adjustment either way, never an aggressive cut. */
export const MINOR_MAX_CALORIE_DELTA = 250;
export const MINOR_AGE = 18;

/** Below this BMI a weight target is refused. */
export const MIN_HEALTHY_BMI = 18.5;

/** Energy in one kg of bodyweight, kcal. Used for rate projections. */
export const KCAL_PER_KG = 7700;

export function isMinor(age: number): boolean {
  return age < MINOR_AGE;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Weight, in kg, at which the given height hits MIN_HEALTHY_BMI. */
export function minHealthyWeightKg(heightCm: number): number {
  const m = heightCm / 100;
  return MIN_HEALTHY_BMI * m * m;
}

export interface TargetWeightCheck {
  ok: boolean;
  /** Neutral, non-shaming copy for the UI. Empty when ok. */
  message: string;
  minWeightKg: number;
}

/**
 * Blocks a target weight that would put the user under BMI 18.5.
 * Message is deliberately flat — no praise, no alarm, no body commentary.
 */
export function checkTargetWeight(targetWeightKg: number, heightCm: number): TargetWeightCheck {
  const minWeightKg = Math.round(minHealthyWeightKg(heightCm) * 10) / 10;

  if (targetWeightKg >= minWeightKg) {
    return { ok: true, message: '', minWeightKg };
  }

  return {
    ok: false,
    minWeightKg,
    message: `That target is below a healthy BMI for your height. The lowest this app will plan for is ${minWeightKg} kg. Pick that or higher, and talk to a doctor if you want to go lower.`,
  };
}

/** Largest daily deficit that keeps weekly loss at or under 1% of bodyweight. */
export function maxDailyDeficit(weightKg: number): number {
  return (weightKg * MAX_WEEKLY_LOSS_FRACTION * KCAL_PER_KG) / 7;
}

export interface ClampInput {
  calories: number;
  maintenance: number;
  sex: Sex;
  age: number;
  weightKg: number;
}

export interface ClampResult {
  calories: number;
  /** Rules that actually changed the number, in the order applied. */
  applied: string[];
}

/**
 * Forces a calorie number inside every §10 bound.
 * Order matters: the weekly-loss cap and the minor cap pull toward maintenance,
 * then the absolute floor wins over everything.
 */
export function clampCalories({
  calories,
  maintenance,
  sex,
  age,
  weightKg,
}: ClampInput): ClampResult {
  const applied: string[] = [];
  let result = Math.round(calories);

  if (isMinor(age)) {
    const lo = maintenance - MINOR_MAX_CALORIE_DELTA;
    const hi = maintenance + MINOR_MAX_CALORIE_DELTA;
    if (result < lo || result > hi) {
      result = Math.min(Math.max(result, lo), hi);
      applied.push('under-18 adjustment capped at 250 kcal');
    }
  }

  const deficitCap = Math.round(maintenance - maxDailyDeficit(weightKg));
  if (result < deficitCap) {
    result = deficitCap;
    applied.push('weekly loss capped at 1% of bodyweight');
  }

  const floor = CALORIE_FLOOR[sex];
  if (result < floor) {
    result = floor;
    applied.push(`calorie floor of ${floor} kcal`);
  }

  return { calories: Math.round(result), applied };
}
