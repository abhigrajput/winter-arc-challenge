'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import type { ProfileUpdate } from '@/lib/supabase/types';
import { buildPlan, planToProfileTargets } from '@/lib/calc/plan';
import { navyBodyFat } from '@/lib/calc/bodyfat';
import { ensureUserTasks } from '@/lib/tasks/ensure';
import { applyGoalPresetToTasks } from '@/lib/tasks/preset';
import { PROGRESS_COOKIE } from '@/lib/onboarding/state';
import {
  baselineSchemaFor,
  bodySchema,
  dietSchema,
  goalSchema,
  identitySchema,
  modulesSchema,
  nextStep,
  routineSchema,
  scheduleSchema,
  STEPS,
  trainingSchema,
  type Step,
} from '@/lib/onboarding/schema';

export interface StepState {
  error?: string;
  /** Field-level messages keyed by input name. */
  fieldErrors?: Record<string, string>;
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return user.id;
}

function flatten(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * profiles.onboarding_step for this submission: the furthest step reached,
 * never lowered when the user goes back and resubmits an earlier one.
 */
async function reachedPatch(step: Step, userId: string): Promise<ProfileUpdate> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('onboarding_step')
    .eq('id', userId)
    .maybeSingle();
  return { onboarding_step: Math.max(data?.onboarding_step ?? -1, STEPS.indexOf(step)) };
}

/** Saves the step's columns and progress in one write, then moves to the next step. */
async function saveAndAdvance(step: Step, patch: ProfileUpdate): Promise<StepState> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, ...(await reachedPatch(step, userId)) })
    .eq('id', userId);

  if (error) {
    if (error.code === '23505') {
      return { fieldErrors: { username: 'That username is taken.' } };
    }
    return { error: 'Could not save. Try again.' };
  }

  revalidatePath('/onboarding', 'layout');
  redirect(`/onboarding/${nextStep(step)}`);
}

// ---------------------------------------------------------------------------
// steps
// ---------------------------------------------------------------------------
export async function saveIdentity(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = identitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('identity', parsed.data);
}

export async function saveBody(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = bodySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('body', parsed.data);
}

export async function saveGoal(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('goal', parsed.data);
}

export async function saveModules(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = modulesSchema.safeParse({ modules: formData.getAll('modules') });
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('modules', parsed.data);
}

export async function saveTraining(_prev: StepState, formData: FormData): Promise<StepState> {
  const raw = {
    training_mode: formData.get('training_mode'),
    equipment: formData.getAll('equipment'),
    max_dumbbell_kg: formData.get('max_dumbbell_kg') || null,
  };
  const parsed = trainingSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('training', parsed.data);
}

export async function saveSchedule(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('schedule', parsed.data);
}

export async function saveDiet(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = dietSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('diet', parsed.data);
}

export async function saveRoutine(_prev: StepState, formData: FormData): Promise<StepState> {
  const parsed = routineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  return saveAndAdvance('routine', parsed.data);
}

/**
 * Baseline writes to body_measurements, not profiles, and also seeds the first
 * body-fat estimate so the result screen has something to show.
 *
 * The whole step is optional: "Skip — measure later" (intent=skip) writes no
 * measurements and sets profiles.skipped_baseline, so the skip holds on any device.
 */
export async function saveBaseline(_prev: StepState, formData: FormData): Promise<StepState> {
  const userId = await requireUserId();

  const supabase = await createClient();

  if (formData.get('intent') === 'skip') {
    const { error } = await supabase
      .from('profiles')
      .update({ skipped_baseline: true, ...(await reachedPatch('baseline', userId)) })
      .eq('id', userId);
    if (error) return { error: 'Could not save. Try again.' };

    revalidatePath('/onboarding', 'layout');
    redirect('/onboarding/result');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('sex, height_cm, weight_kg, challenge_start')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.sex || !profile.height_cm) {
    return { error: 'Finish the earlier steps first.' };
  }

  const raw = {
    waist_cm: formData.get('waist_cm'),
    neck_cm: formData.get('neck_cm'),
    hip_cm: formData.get('hip_cm') || null,
  };

  const parsed = baselineSchemaFor(profile.sex).safeParse(raw);
  if (!parsed.success) return { fieldErrors: flatten(parsed.error) };

  const bodyFat = navyBodyFat({
    sex: profile.sex,
    heightCm: profile.height_cm,
    waistCm: parsed.data.waist_cm,
    neckCm: parsed.data.neck_cm,
    hipCm: parsed.data.hip_cm,
  });

  const logDate = profile.challenge_start ?? new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from('body_measurements').upsert(
    {
      user_id: userId,
      log_date: logDate,
      weight_kg: profile.weight_kg,
      waist_cm: parsed.data.waist_cm,
      neck_cm: parsed.data.neck_cm,
      hip_cm: parsed.data.hip_cm,
      body_fat_pct: bodyFat,
    },
    { onConflict: 'user_id,log_date' },
  );

  if (error) return { error: 'Could not save your measurements. Try again.' };

  await supabase
    .from('profiles')
    .update({ skipped_baseline: false, ...(await reachedPatch('baseline', userId)) })
    .eq('id', userId);
  revalidatePath('/onboarding', 'layout');
  redirect('/onboarding/result');
}

/**
 * Finishes onboarding: recomputes the plan from the saved profile, writes the
 * targets, flips onboarded. Everything here goes through lib/calc, so the
 * §10 guardrails apply to the stored numbers too.
 */
export async function finishOnboarding(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (
    !profile?.sex ||
    !profile.age ||
    !profile.height_cm ||
    !profile.weight_kg ||
    !profile.target_weight_kg ||
    !profile.activity_level ||
    !profile.goal
  ) {
    redirect('/onboarding');
  }

  const plan = buildPlan({
    sex: profile.sex,
    age: profile.age,
    heightCm: profile.height_cm,
    weightKg: profile.weight_kg,
    targetWeightKg: profile.target_weight_kg,
    activityLevel: profile.activity_level,
    goal: profile.goal,
  });

  const { data: finished } = await supabase
    .from('profiles')
    .update({ ...planToProfileTargets(plan), onboarded: true })
    .eq('id', userId)
    .select()
    .maybeSingle();

  // The database seeds user_tasks by trigger at signup, long before a goal or
  // any modules are known, so reconcile them here where the profile is finally
  // complete. ensureUserTasks covers the case where no rows exist at all.
  if (finished) {
    await ensureUserTasks(finished);
    await applyGoalPresetToTasks(userId, finished.goal, finished.modules);
  }

  const cookieStore = await cookies();
  cookieStore.delete(PROGRESS_COOKIE);

  revalidatePath('/', 'layout');
  redirect('/today');
}
