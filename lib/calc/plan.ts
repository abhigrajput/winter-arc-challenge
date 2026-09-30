import type { PrimaryGoal, Sex } from '@/lib/supabase/types';
import { tdee as computeTdee } from '@/lib/calc/tdee';
import { calorieTarget, macroTargets, waterTargetMl, type MacroTargets } from '@/lib/calc/macros';
import { bodyFatRange, navyBodyFat } from '@/lib/calc/bodyfat';
import { projectWeight, type Projection } from '@/lib/calc/projection';

/**
 * Composes the whole numeric plan from a profile. This is what the onboarding
 * result screen shows and what gets written to profiles.*_target columns.
 */

export interface PlanInput {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  activityLevel: number;
  goal: PrimaryGoal;
  /** Baseline tape measurements. Body fat is omitted when these are missing. */
  waistCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
}

export interface Plan {
  bmr: number;
  tdee: number;
  calories: {
    target: number;
    min: number;
    max: number;
    maintenance: number;
    applied: string[];
  };
  macros: MacroTargets;
  waterMl: number;
  bodyFat: { estimate: number; low: number; high: number } | null;
  projection: Projection;
}

export function buildPlan(input: PlanInput): Plan {
  const { sex, age, heightCm, weightKg, activityLevel, goal } = input;

  const bmrInput = { sex, age, heightCm, weightKg };
  const maintenance = computeTdee(bmrInput, activityLevel);

  const calories = calorieTarget({ tdee: maintenance, goal, sex, age, weightKg });
  const macros = macroTargets({ calories: calories.target, weightKg, goal });

  const estimate =
    input.waistCm && input.neckCm
      ? navyBodyFat({
          sex,
          heightCm,
          waistCm: input.waistCm,
          neckCm: input.neckCm,
          hipCm: input.hipCm,
        })
      : null;

  return {
    bmr: Math.round(maintenance / activityLevel),
    tdee: maintenance,
    calories,
    macros,
    waterMl: waterTargetMl(weightKg),
    bodyFat: estimate === null ? null : { estimate, ...bodyFatRange(estimate) },
    projection: projectWeight({
      weightKg,
      calorieTarget: calories.target,
      maintenance,
      goal,
    }),
  };
}

/** The subset of a plan that is persisted on profiles. */
export function planToProfileTargets(plan: Plan) {
  return {
    calorie_target: plan.calories.target,
    protein_target_g: plan.macros.proteinG,
    carbs_target_g: plan.macros.carbsG,
    fat_target_g: plan.macros.fatG,
    water_target_ml: plan.waterMl,
  };
}
