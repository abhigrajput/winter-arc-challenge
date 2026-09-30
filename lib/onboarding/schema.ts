import { z } from 'zod';
import { ACTIVITY_VALUES } from '@/lib/calc/tdee';
import { checkTargetWeight } from '@/lib/calc/guardrails';

/**
 * One schema per onboarding step (§5). Each step saves on submit, so every
 * schema validates exactly the columns that step writes — nothing else.
 */

export const STEPS = [
  'identity',
  'body',
  'goal',
  'modules',
  'training',
  'schedule',
  'diet',
  'routine',
  'baseline',
  'result',
] as const;

export type Step = (typeof STEPS)[number];

export const STEP_TITLES: Record<Step, string> = {
  identity: 'Who you are',
  body: 'Your numbers',
  goal: 'The goal',
  modules: 'Add-ons',
  training: 'Where you train',
  schedule: 'How often',
  diet: 'How you eat',
  routine: 'Sleep and wake',
  baseline: 'Baseline',
  result: 'Your plan',
};

/** Steps the user fills in. `result` is a read-only screen at the end. */
export const INPUT_STEPS = STEPS.filter((s) => s !== 'result');

export function isStep(value: string): value is Step {
  return (STEPS as readonly string[]).includes(value);
}

export function nextStep(step: Step): Step {
  const index = STEPS.indexOf(step);
  return STEPS[Math.min(index + 1, STEPS.length - 1)]!;
}

export function previousStep(step: Step): Step | null {
  const index = STEPS.indexOf(step);
  return index <= 0 ? null : STEPS[index - 1]!;
}

// ---------------------------------------------------------------------------
// shared field types
// ---------------------------------------------------------------------------
const numberField = (label: string) =>
  z.coerce.number({ message: `${label} is required.` }).finite();

export const MODULE_SLUGS = ['abs', 'face_skin', 'jawline', 'running', 'content_creator'] as const;

export const EQUIPMENT_SLUGS = [
  'pull_up_bar',
  'dumbbells',
  'bands',
  'bench',
  'barbell',
  'machines',
] as const;

export const EQUIPMENT_LABELS: Record<(typeof EQUIPMENT_SLUGS)[number], string> = {
  pull_up_bar: 'Pull-up bar',
  dumbbells: 'Dumbbells',
  bands: 'Resistance bands',
  bench: 'Bench',
  barbell: 'Barbell',
  machines: 'Machines',
};

// ---------------------------------------------------------------------------
// step 1 — identity
// ---------------------------------------------------------------------------
export const identitySchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'At least 3 characters.')
    .max(20, 'At most 20 characters.')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscores only.'),
  display_name: z.string().trim().min(1, 'Required.').max(40, 'At most 40 characters.'),
  timezone: z.string().trim().min(1, 'Pick a timezone.'),
  challenge_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a start date.'),
});

// ---------------------------------------------------------------------------
// step 2 — body
// ---------------------------------------------------------------------------
export const bodySchema = z
  .object({
    sex: z.enum(['male', 'female'], { message: 'Pick one.' }),
    age: numberField('Age').int().min(13, 'Must be 13 or older.').max(100, 'Enter a real age.'),
    height_cm: numberField('Height').min(100, 'Enter height in cm.').max(250, 'Enter height in cm.'),
    weight_kg: numberField('Weight').min(25, 'Enter weight in kg.').max(300, 'Enter weight in kg.'),
    target_weight_kg: numberField('Target weight')
      .min(25, 'Enter weight in kg.')
      .max(300, 'Enter weight in kg.'),
    activity_level: numberField('Activity level').refine(
      (v) => ACTIVITY_VALUES.includes(v),
      'Pick an activity level.',
    ),
  })
  // §10: refuse a target that lands under BMI 18.5.
  .superRefine((data, ctx) => {
    const check = checkTargetWeight(data.target_weight_kg, data.height_cm);
    if (!check.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['target_weight_kg'],
        message: check.message,
      });
    }
  });

// ---------------------------------------------------------------------------
// step 3 — goal
// ---------------------------------------------------------------------------
export const goalSchema = z.object({
  goal: z.enum(['fat_loss', 'lean_bulk', 'recomp', 'six_pack', 'discipline', 'spiritual'], {
    message: 'Pick a goal.',
  }),
});

// ---------------------------------------------------------------------------
// step 4 — modules
// ---------------------------------------------------------------------------
export const modulesSchema = z.object({
  modules: z.array(z.enum(MODULE_SLUGS)).default([]),
});

// ---------------------------------------------------------------------------
// step 5 — training
// ---------------------------------------------------------------------------
export const trainingSchema = z
  .object({
    training_mode: z.enum(['gym', 'home', 'hybrid'], { message: 'Pick one.' }),
    equipment: z.array(z.enum(EQUIPMENT_SLUGS)).default([]),
    max_dumbbell_kg: z.coerce.number().min(0).max(100).nullable().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.equipment.includes('dumbbells') && !data.max_dumbbell_kg) {
      ctx.addIssue({
        code: 'custom',
        path: ['max_dumbbell_kg'],
        message: 'How heavy do your dumbbells go?',
      });
    }
  });

// ---------------------------------------------------------------------------
// step 6 — schedule
// ---------------------------------------------------------------------------
export const scheduleSchema = z.object({
  fitness_level: z.enum(['beginner', 'intermediate', 'advanced'], { message: 'Pick one.' }),
  days_per_week: numberField('Days per week').int().min(3, 'Minimum 3.').max(6, 'Maximum 6.'),
  session_minutes: numberField('Session length').refine(
    (v) => [30, 45, 60, 90].includes(v),
    'Pick a session length.',
  ),
});

// ---------------------------------------------------------------------------
// step 7 — diet
// ---------------------------------------------------------------------------
export const dietSchema = z.object({
  diet_type: z.enum(['veg', 'egg', 'nonveg'], { message: 'Pick one.' }),
  diet_notes: z.string().trim().max(500, 'Keep it under 500 characters.').default(''),
  budget: z.enum(['hostel', 'normal'], { message: 'Pick one.' }),
});

// ---------------------------------------------------------------------------
// step 8 — routine
// ---------------------------------------------------------------------------
export const routineSchema = z.object({
  wake_time: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a wake time.'),
  sleep_target_h: numberField('Sleep target').min(4, 'At least 4 h.').max(12, 'At most 12 h.'),
});

// ---------------------------------------------------------------------------
// step 9 — baseline
// ---------------------------------------------------------------------------
export const baselineSchema = z.object({
  waist_cm: z.coerce.number().min(40, 'Enter cm.').max(200, 'Enter cm.'),
  neck_cm: z.coerce.number().min(20, 'Enter cm.').max(80, 'Enter cm.'),
  hip_cm: z.coerce.number().min(50, 'Enter cm.').max(200, 'Enter cm.').nullable().default(null),
});

/** Women need a hip measurement for the US Navy formula. */
export function baselineSchemaFor(sex: 'male' | 'female') {
  if (sex === 'male') return baselineSchema;
  return baselineSchema.superRefine((data, ctx) => {
    if (!data.hip_cm) {
      ctx.addIssue({
        code: 'custom',
        path: ['hip_cm'],
        message: 'Needed for the body fat estimate.',
      });
    }
  });
}

export type IdentityInput = z.infer<typeof identitySchema>;
export type BodyInput = z.infer<typeof bodySchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type ModulesInput = z.infer<typeof modulesSchema>;
export type TrainingInput = z.infer<typeof trainingSchema>;
export type ScheduleInput = z.infer<typeof scheduleSchema>;
export type DietInput = z.infer<typeof dietSchema>;
export type RoutineInput = z.infer<typeof routineSchema>;
export type BaselineInput = z.infer<typeof baselineSchema>;
