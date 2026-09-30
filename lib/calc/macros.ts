import type { PrimaryGoal, Sex } from '@/lib/supabase/types';
import { clampCalories } from '@/lib/calc/guardrails';

/**
 * Calorie and macro targets. §6.
 * Every number that reaches the UI has already been through the §10 guardrails.
 */

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Raw deficit/surplus per goal, before guardrails. */
const GOAL_DELTA: Record<PrimaryGoal, { min: number; max: number } | { pctOfTdee: number }> = {
  fat_loss: { min: -500, max: -300 },
  six_pack: { min: -500, max: -300 },
  lean_bulk: { min: 250, max: 350 },
  recomp: { pctOfTdee: -0.1 },
  discipline: { min: 0, max: 0 },
  spiritual: { min: 0, max: 0 },
};

/** Protein g/kg bodyweight. Higher when the deficit is bigger. */
const PROTEIN_PER_KG: Record<PrimaryGoal, number> = {
  fat_loss: 2.2,
  six_pack: 2.2,
  recomp: 2.0,
  lean_bulk: 1.8,
  discipline: 1.6,
  spiritual: 1.6,
};

/** Fat g/kg. FAT_MIN_PER_KG is a hard floor — carbs give way first. */
const FAT_PER_KG = 0.8;
export const FAT_MIN_PER_KG = 0.6;

export interface CalorieTargetInput {
  tdee: number;
  goal: PrimaryGoal;
  sex: Sex;
  age: number;
  weightKg: number;
}

export interface CalorieTarget {
  /** The number to eat to. */
  target: number;
  /** Guardrailed ends of the goal's range — shown as "stay between". */
  min: number;
  max: number;
  maintenance: number;
  /** Guardrails that moved the target, for honest UI copy. Empty if none. */
  applied: string[];
}

/**
 * Calorie target for a goal, clamped by the floors and the 1%/week loss cap.
 * The returned range is the goal band, not a licence to drift outside it.
 */
export function calorieTarget(input: CalorieTargetInput): CalorieTarget {
  const { tdee: maintenance, goal, sex, age, weightKg } = input;
  const delta = GOAL_DELTA[goal];

  const rawMin =
    'pctOfTdee' in delta
      ? maintenance + maintenance * delta.pctOfTdee
      : maintenance + delta.min;
  const rawMax =
    'pctOfTdee' in delta
      ? maintenance + maintenance * delta.pctOfTdee
      : maintenance + delta.max;

  const clampOne = (calories: number) =>
    clampCalories({ calories, maintenance, sex, age, weightKg });

  const low = clampOne(Math.min(rawMin, rawMax));
  const high = clampOne(Math.max(rawMin, rawMax));
  // Midpoint of the clamped band, so the target never sits outside it.
  const mid = clampOne((low.calories + high.calories) / 2);

  const applied = [...new Set([...low.applied, ...high.applied, ...mid.applied])];

  return {
    target: mid.calories,
    min: low.calories,
    max: high.calories,
    maintenance,
    applied,
  };
}

export interface MacroInput {
  calories: number;
  weightKg: number;
  goal: PrimaryGoal;
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** True when protein/fat had to be trimmed to fit the calorie budget. */
  trimmed: boolean;
}

/**
 * Protein 1.6-2.2 g/kg, fat >= 0.6 g/kg, carbs take the remainder.
 * On a very low budget, fat drops to its floor first, then protein — carbs
 * never go negative.
 */
export function macroTargets({ calories, weightKg, goal }: MacroInput): MacroTargets {
  let proteinG = Math.round(PROTEIN_PER_KG[goal] * weightKg);
  let fatG = Math.round(FAT_PER_KG * weightKg);
  let trimmed = false;

  const budget = () => calories - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat;

  if (budget() < 0) {
    const fatFloor = Math.round(FAT_MIN_PER_KG * weightKg);
    fatG = fatFloor;
    trimmed = true;
  }

  if (budget() < 0) {
    // Still over: spend what is left on protein and accept zero carbs.
    proteinG = Math.max(0, Math.floor((calories - fatG * KCAL_PER_G.fat) / KCAL_PER_G.protein));
    trimmed = true;
  }

  return {
    proteinG,
    fatG,
    carbsG: Math.max(0, Math.round(budget() / KCAL_PER_G.carbs)),
    trimmed,
  };
}

export const WATER_ML_PER_KG = 35;
export const WATER_MIN_ML = 2500;

/** 35 ml/kg, never under 2.5 L. Rounded to the nearest 100 ml. */
export function waterTargetMl(weightKg: number): number {
  const raw = Math.max(weightKg * WATER_ML_PER_KG, WATER_MIN_ML);
  return Math.round(raw / 100) * 100;
}
