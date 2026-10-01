import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { FoodEntryRow, ProfileRow } from '@/lib/supabase/types';
import { localDate } from '@/lib/calc/day';
import { caloriesInRange, ring, sumEntries, type MacroTotals, type Ring } from '@/lib/calc/nutrition';

/**
 * A day's nutrition: entries, totals and the three rings (§8.5).
 */

export interface NutritionDay {
  logDate: string;
  entries: FoodEntryRow[];
  totals: MacroTotals;
  rings: { calories: Ring; protein: Ring; water: Ring };
  waterMl: number;
  inCalorieRange: boolean;
}

export async function loadNutritionDay(
  profile: ProfileRow,
  now: Date = new Date(),
): Promise<NutritionDay> {
  const supabase = await createClient();
  const logDate = localDate(profile.timezone ?? '', now);

  const [{ data: entries }, { data: water }] = await Promise.all([
    supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', profile.id)
      .eq('log_date', logDate)
      .order('created_at', { ascending: true }),
    supabase
      .from('water_logs')
      .select('ml')
      .eq('user_id', profile.id)
      .eq('log_date', logDate)
      .maybeSingle(),
  ]);

  const rows = entries ?? [];
  const totals = sumEntries(rows);
  const waterMl = water?.ml ?? 0;

  return {
    logDate,
    entries: rows,
    totals,
    waterMl,
    inCalorieRange: caloriesInRange(totals.calories, profile.calorie_target),
    rings: {
      calories: ring(totals.calories, profile.calorie_target),
      protein: ring(totals.proteinG, profile.protein_target_g),
      water: ring(waterMl, profile.water_target_ml),
    },
  };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/**
 * §8.10: nutrition logging ticks its own tasks off.
 *
 * Each task is re-evaluated from the day's totals rather than toggled, so
 * removing an entry un-ticks it again.
 */
export async function syncNutritionTasks(
  profile: ProfileRow,
  day: NutritionDay,
): Promise<void> {
  const supabase = await createClient();

  await Promise.all([
    setTaskBySlug(supabase, profile.id, day.logDate, 'protein', day.rings.protein.hit, day.totals.proteinG),
    setTaskBySlug(supabase, profile.id, day.logDate, 'calories', day.inCalorieRange, day.totals.calories),
    setTaskBySlug(supabase, profile.id, day.logDate, 'water', day.rings.water.hit, day.waterMl / 1000),
  ]);
}

async function setTaskBySlug(
  supabase: Supa,
  userId: string,
  logDate: string,
  slug: string,
  completed: boolean,
  value: number,
): Promise<void> {
  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!template) return;

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .eq('active', true)
    .maybeSingle();

  if (!task) return;

  await supabase
    .from('daily_logs')
    .update({
      completed,
      value: Math.round(value * 100) / 100,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('user_task_id', task.id)
    .eq('log_date', logDate);
}
