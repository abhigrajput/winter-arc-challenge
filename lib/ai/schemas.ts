import { z } from 'zod';

/**
 * Response schemas for every AI plan type (§8.9).
 *
 * §4 is strict about the pipeline: strip fences → JSON.parse → zod validate →
 * guardrail check → save. These schemas are the second gate, so they are
 * deliberately tight — unknown shapes are rejected rather than coerced.
 */

export const PLAN_TYPES = ['workout', 'diet', 'skincare'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export function isPlanType(value: string): value is PlanType {
  return (PLAN_TYPES as readonly string[]).includes(value);
}

const shortText = z.string().trim().min(1).max(300);
const noteList = z.array(shortText).max(10).default([]);

// ---------------------------------------------------------------------------
// workout
// ---------------------------------------------------------------------------
export const workoutExerciseSchema = z.object({
  name: shortText,
  sets: z.number().int().min(1).max(10),
  /** Free text so "8-12", "AMRAP" and "30s hold" all round-trip. */
  reps: z.string().trim().min(1).max(40),
  notes: shortText.optional(),
});

export const workoutDaySchema = z.object({
  name: shortText,
  focus: shortText,
  exercises: z.array(workoutExerciseSchema).min(1).max(10),
});

export const workoutPlanSchema = z.object({
  week: z.number().int().min(1).max(13),
  split: shortText,
  deload: z.boolean().default(false),
  days: z.array(workoutDaySchema).min(1).max(7),
  progression: shortText,
  notes: noteList,
});

export type WorkoutPlan = z.infer<typeof workoutPlanSchema>;

// ---------------------------------------------------------------------------
// diet
// ---------------------------------------------------------------------------
export const mealItemSchema = z.object({
  food: shortText,
  quantity: shortText,
  calories: z.number().int().min(0).max(3000),
  protein_g: z.number().min(0).max(300),
});

export const mealSchema = z.object({
  name: shortText,
  items: z.array(mealItemSchema).min(1).max(12),
  calories: z.number().int().min(0).max(4000),
  protein_g: z.number().min(0).max(400),
});

export const dietPlanSchema = z.object({
  week: z.number().int().min(1).max(13),
  calorie_target: z.number().int().min(800).max(6000),
  protein_g: z.number().int().min(0).max(400),
  carbs_g: z.number().int().min(0).max(800),
  fat_g: z.number().int().min(0).max(300),
  meals: z.array(mealSchema).min(1).max(8),
  swaps: z
    .array(z.object({ instead_of: shortText, use: shortText }))
    .max(10)
    .default([]),
  notes: noteList,
});

export type DietPlan = z.infer<typeof dietPlanSchema>;

// ---------------------------------------------------------------------------
// skincare — §8.3 allows OTC actives only
// ---------------------------------------------------------------------------
export const ALLOWED_ACTIVES = [
  'benzoyl peroxide',
  'salicylic acid',
  'niacinamide',
  'adapalene',
  'azelaic acid',
  'sunscreen',
  'moisturiser',
  'moisturizer',
  'cleanser',
] as const;

export const routineStepSchema = z.object({
  step: z.number().int().min(1).max(8),
  product: shortText,
  instructions: shortText,
});

export const skincarePlanSchema = z.object({
  week: z.number().int().min(1).max(13),
  am: z.array(routineStepSchema).min(1).max(6),
  pm: z.array(routineStepSchema).min(1).max(6),
  actives: z
    .array(
      z.object({
        name: shortText,
        frequency: shortText,
        introduction: shortText,
      }),
    )
    .max(3)
    .default([]),
  notes: noteList,
});

export type SkincarePlan = z.infer<typeof skincarePlanSchema>;

// ---------------------------------------------------------------------------
export const planSchemas = {
  workout: workoutPlanSchema,
  diet: dietPlanSchema,
  skincare: skincarePlanSchema,
} as const;

export type PlanContent = WorkoutPlan | DietPlan | SkincarePlan;

/**
 * Models like to wrap JSON in ```json fences or add a sentence before it.
 * §4 requires stripping that before parsing.
 */
export function stripFences(raw: string): string {
  let text = raw.trim();

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) text = fenced[1].trim();

  // Fall back to the outermost braces if prose still surrounds the object.
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  return text.trim();
}

export type ParseResult =
  | { ok: true; plan: PlanContent }
  | { ok: false; reasons: string[] };

/**
 * The deterministic half of the §4 pipeline: strip fences, parse, validate.
 * Pure, so it is unit tested directly without touching a model.
 */
export function parseAndValidate(
  schema: (typeof planSchemas)[PlanType],
  raw: string,
): ParseResult {
  const text = stripFences(raw);

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reasons: ['response was not valid JSON'] };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      reasons: result.error.issues
        .slice(0, 6)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    };
  }

  return { ok: true, plan: result.data as PlanContent };
}
