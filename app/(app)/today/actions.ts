'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isWritableLogDate } from '@/lib/calc/day';
import { isNumericTaskComplete } from '@/lib/tasks/kinds';

/**
 * Task logging. §4: writes are accepted only for yesterday, today and
 * tomorrow, measured in the user's own timezone.
 *
 * The live database does not enforce that window (see supabase/schema.sql), so
 * this layer is the only thing standing between the app and backfilled logs.
 * RLS still guarantees a user can only ever touch their own rows.
 */

export interface LogResult {
  error?: string;
}

const toggleInput = z.object({
  taskId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completed: z.boolean(),
});

const valueInput = z.object({
  taskId: z.string().uuid(),
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.number().min(0).max(1_000_000),
});

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();

  return { supabase, userId: user.id, timezone: profile?.timezone ?? '' };
}

/** Marks a check-style task done or not done. */
export async function toggleTask(input: unknown): Promise<LogResult> {
  const parsed = toggleInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, userId, timezone } = await context();
  const { taskId, logDate, completed } = parsed.data;

  if (!isWritableLogDate(logDate, timezone)) {
    return { error: 'You can only log yesterday, today and tomorrow.' };
  }

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id, target, unit')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!task) return { error: 'Task not found.' };

  const { error } = await supabase
    .from('daily_logs')
    .update({
      completed,
      // Checking off a numeric task fills its bar; unchecking empties it.
      value: completed ? task.target : 0,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('user_task_id', taskId)
    .eq('log_date', logDate);

  if (error) return { error: 'Could not save. Try again.' };

  revalidatePath('/today');
  return {};
}

/**
 * Sets the amount done on a numeric task (steps, minutes, litres).
 * Completion is derived: hitting the target completes it.
 */
export async function setTaskValue(input: unknown): Promise<LogResult> {
  const parsed = valueInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, userId, timezone } = await context();
  const { taskId, logDate, value } = parsed.data;

  if (!isWritableLogDate(logDate, timezone)) {
    return { error: 'You can only log yesterday, today and tomorrow.' };
  }

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id, target, template_id')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!task) return { error: 'Task not found.' };

  // "Under 30 min" style tasks are satisfied by staying below the target, so
  // completion cannot simply be value >= target.
  const slug = await templateSlug(supabase, task.template_id);
  const target = Number(task.target ?? 0);
  const completed = isNumericTaskComplete(value, target, slug);

  const { error } = await supabase
    .from('daily_logs')
    .update({
      value,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('user_task_id', taskId)
    .eq('log_date', logDate);

  if (error) return { error: 'Could not save. Try again.' };

  revalidatePath('/today');
  return {};
}

/** Template slug for a task, used to tell cap tasks from floor tasks. */
async function templateSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: number | null,
): Promise<string | null> {
  if (templateId === null) return null;
  const { data } = await supabase
    .from('task_templates')
    .select('slug')
    .eq('id', templateId)
    .maybeSingle();
  return data?.slug ?? null;
}
