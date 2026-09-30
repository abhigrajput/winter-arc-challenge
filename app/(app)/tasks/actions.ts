'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { effectiveModules } from '@/lib/goals';
import { applyGoalPresetToTasks } from '@/lib/tasks/preset';
import { MODULE_SLUGS } from '@/lib/onboarding/schema';

/**
 * Task management (§9): switch tasks on and off, edit targets, add custom
 * tasks, turn modules on and off.
 *
 * Deactivating a task removes its log rows from today onward only. Past days
 * keep theirs, so a streak already earned can never be rewritten by a change
 * made later.
 */

export interface TaskResult {
  error?: string;
}

const CATEGORIES = ['discipline', 'body', 'face', 'mind', 'spirit', 'work'] as const;
const UNITS = ['check', 'min', 'rounds', 'steps', 'km', 'L'] as const;

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, timezone, goal, modules')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');
  return { supabase, profile };
}

// ---------------------------------------------------------------------------
// individual tasks
// ---------------------------------------------------------------------------
const toggleActiveInput = z.object({ taskId: z.string().uuid(), active: z.boolean() });

export async function setTaskActive(input: unknown): Promise<TaskResult> {
  const parsed = toggleActiveInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();
  const { taskId, active } = parsed.data;

  const { error } = await supabase
    .from('user_tasks')
    .update({ active })
    .eq('id', taskId)
    .eq('user_id', profile.id);

  if (error) return { error: 'Could not save. Try again.' };

  // The orphaned log row for today is left in place — the live database has no
  // DELETE policy on daily_logs. It is excluded from today's totals instead,
  // in lib/calc/streak.ts.
  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}

const targetInput = z.object({
  taskId: z.string().uuid(),
  target: z.coerce.number().positive('Target must be greater than 0.').max(1_000_000),
});

export async function setTaskTarget(input: unknown): Promise<TaskResult> {
  const parsed = targetInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid target.' };
  }

  const { supabase, profile } = await context();

  const { error } = await supabase
    .from('user_tasks')
    .update({ target: parsed.data.target })
    .eq('id', parsed.data.taskId)
    .eq('user_id', profile.id);

  if (error) return { error: 'Could not save. Try again.' };

  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}

const customTaskInput = z.object({
  title: z.string().trim().min(1, 'Give it a name.').max(60, 'Keep it under 60 characters.'),
  category: z.enum(CATEGORIES, { message: 'Pick a group.' }),
  unit: z.enum(UNITS, { message: 'Pick a unit.' }),
  target: z.coerce.number().positive('Target must be greater than 0.').max(1_000_000),
});

export async function addCustomTask(_prev: TaskResult, formData: FormData): Promise<TaskResult> {
  const parsed = customTaskInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid task.' };
  }

  const { supabase, profile } = await context();

  const { data: last } = await supabase
    .from('user_tasks')
    .select('sort_order')
    .eq('user_id', profile.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('user_tasks').insert({
    user_id: profile.id,
    template_id: null,
    title: parsed.data.title,
    category: parsed.data.category,
    target: parsed.data.target,
    unit: parsed.data.unit,
    is_custom: true,
    active: true,
    sort_order: (last?.sort_order ?? 0) + 1,
  });

  if (error) return { error: 'Could not add the task. Try again.' };

  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}

const deleteInput = z.object({ taskId: z.string().uuid() });

/** Only custom tasks can be deleted. Seeded ones are switched off instead. */
export async function deleteCustomTask(input: unknown): Promise<TaskResult> {
  const parsed = deleteInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();

  const { error } = await supabase
    .from('user_tasks')
    .delete()
    .eq('id', parsed.data.taskId)
    .eq('user_id', profile.id)
    .eq('is_custom', true);

  if (error) return { error: 'Could not delete. Try again.' };

  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}

// ---------------------------------------------------------------------------
// modules
// ---------------------------------------------------------------------------
const moduleInput = z.object({
  module: z.enum(MODULE_SLUGS),
  enabled: z.boolean(),
});

/**
 * Turning a module on or off updates profiles.modules and flips every task
 * belonging to it. A module the current goal forces on cannot be turned off.
 */
export async function setModule(input: unknown): Promise<TaskResult> {
  const parsed = moduleInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();
  const { module, enabled } = parsed.data;

  if (!enabled && goalForces(profile.goal, module)) {
    return { error: 'Your goal keeps this module on.' };
  }

  const current = new Set(profile.modules ?? []);
  if (enabled) current.add(module);
  else current.delete(module);

  const { error } = await supabase
    .from('profiles')
    .update({ modules: [...current] })
    .eq('id', profile.id);

  if (error) return { error: 'Could not save. Try again.' };

  // Flip the tasks that belong to this module.
  const { data: templates } = await supabase
    .from('task_templates')
    .select('id')
    .eq('module', module);

  const templateIds = (templates ?? []).map((t) => t.id);
  if (templateIds.length > 0) {
    await supabase
      .from('user_tasks')
      .update({ active: enabled })
      .eq('user_id', profile.id)
      .in('template_id', templateIds);
  }

  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}

function goalForces(goal: string | null, module: string): boolean {
  return effectiveModules(goal as never, []).has(module);
}

// ---------------------------------------------------------------------------
// goal preset
// ---------------------------------------------------------------------------
/**
 * Resets seeded tasks to the current goal's preset: targets, wording and which
 * are active. Custom tasks are left alone. Explicit action only — changing goal
 * never silently rewrites targets the user has edited.
 */
export async function applyGoalPreset(): Promise<TaskResult> {
  const { profile } = await context();

  await applyGoalPresetToTasks(profile.id, profile.goal, profile.modules);

  revalidatePath('/tasks');
  revalidatePath('/today');
  return {};
}
