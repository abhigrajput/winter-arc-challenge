'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isWritableLogDate, localDate } from '@/lib/calc/day';
import { loadNutritionDay, syncNutritionTasks } from '@/lib/nutrition/day';

/**
 * Nutrition logging (§8.5). Every write re-syncs the protein, calorie and
 * water tasks from the day's totals, so the checklist cannot drift from what
 * was actually eaten.
 */

export interface NutritionResult {
  error?: string;
}

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');
  return { supabase, profile };
}

/** Recomputes totals and re-ticks the nutrition tasks. */
async function refresh(profile: Awaited<ReturnType<typeof context>>['profile']) {
  const day = await loadNutritionDay(profile);
  await syncNutritionTasks(profile, day);
  revalidatePath('/nutrition');
  revalidatePath('/today');
}

const addEntryInput = z.object({
  description: z.string().trim().min(1, 'What did you eat?').max(200),
  meal: z.enum(['breakfast', 'lunch', 'snack', 'dinner']).nullable().default(null),
  calories: z.coerce.number().int().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(400).default(0),
  carbsG: z.coerce.number().min(0).max(800).default(0),
  fatG: z.coerce.number().min(0).max(300).default(0),
  // Verified against the live CHECK constraint food_entries_source_check,
  // which allows exactly these three (or null). They map onto the three §8.5
  // logging modes: plan ticks, quick add, and the AI estimate.
  source: z.enum(['manual', 'plan', 'ai_estimate']).default('manual'),
});

export async function addFoodEntry(input: unknown): Promise<NutritionResult> {
  const parsed = addEntryInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid entry.' };
  }

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  // §4: logging is only open for yesterday, today and tomorrow.
  if (!isWritableLogDate(logDate, profile.timezone ?? '')) {
    return { error: 'You can only log yesterday, today and tomorrow.' };
  }

  const { error } = await supabase.from('food_entries').insert({
    user_id: profile.id,
    log_date: logDate,
    meal: parsed.data.meal,
    description: parsed.data.description,
    calories: parsed.data.calories,
    protein_g: parsed.data.proteinG,
    carbs_g: parsed.data.carbsG,
    fat_g: parsed.data.fatG,
    source: parsed.data.source,
  });

  if (error) return { error: 'Could not save that. Try again.' };

  await refresh(profile);
  return {};
}

const deleteEntryInput = z.object({ entryId: z.string().uuid() });

export async function deleteFoodEntry(input: unknown): Promise<NutritionResult> {
  const parsed = deleteEntryInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();

  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', parsed.data.entryId)
    .eq('user_id', profile.id);

  if (error) return { error: 'Could not remove that. Try again.' };

  await refresh(profile);
  return {};
}

const waterInput = z.object({ deltaMl: z.coerce.number().int().min(-5000).max(5000) });

/** Adds or removes water for today. Never goes below zero. */
export async function logWater(input: unknown): Promise<NutritionResult> {
  const parsed = waterInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid amount.' };

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  const { data: existing } = await supabase
    .from('water_logs')
    .select('ml')
    .eq('user_id', profile.id)
    .eq('log_date', logDate)
    .maybeSingle();

  const next = Math.max(0, (existing?.ml ?? 0) + parsed.data.deltaMl);

  const { error } = await supabase
    .from('water_logs')
    .upsert({ user_id: profile.id, log_date: logDate, ml: next }, { onConflict: 'user_id,log_date' });

  if (error) return { error: 'Could not save your water. Try again.' };

  await refresh(profile);
  return {};
}

const planMealInput = z.object({
  name: z.string().trim().min(1).max(100),
  calories: z.coerce.number().int().min(0).max(5000),
  proteinG: z.coerce.number().min(0).max(400),
});

/** §8.5(a): tick a meal off the AI diet plan and take its macros. */
export async function logPlanMeal(input: unknown): Promise<NutritionResult> {
  const parsed = planMealInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid meal.' };

  return addFoodEntry({
    description: parsed.data.name,
    meal: null,
    calories: parsed.data.calories,
    proteinG: parsed.data.proteinG,
    carbsG: 0,
    fatG: 0,
    source: 'plan',
  });
}
