'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { localDate } from '@/lib/calc/day';

/**
 * Skin log writes (§8.3).
 *
 * Completing the AM or PM routine ticks the matching daily task, and clearing
 * it un-ticks again — same rule as nutrition: the checklist follows the log.
 */

export interface FaceResult {
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

const skinInput = z.object({
  amDone: z.boolean().optional(),
  pmDone: z.boolean().optional(),
  // The live CHECK constraint is 0-5 inclusive, verified against the database.
  breakouts: z.number().int().min(0).max(5).nullable().optional(),
  dairy: z.boolean().nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function saveSkinLog(input: unknown): Promise<FaceResult> {
  const parsed = skinInput.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid entry.' };
  }

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  const { data: existing } = await supabase
    .from('skin_logs')
    .select('*')
    .eq('user_id', profile.id)
    .eq('log_date', logDate)
    .maybeSingle();

  const merged = {
    am_done: parsed.data.amDone ?? existing?.am_done ?? false,
    pm_done: parsed.data.pmDone ?? existing?.pm_done ?? false,
    breakouts:
      parsed.data.breakouts === undefined ? (existing?.breakouts ?? null) : parsed.data.breakouts,
    dairy: parsed.data.dairy === undefined ? (existing?.dairy ?? null) : parsed.data.dairy,
    notes: parsed.data.notes === undefined ? (existing?.notes ?? null) : parsed.data.notes || null,
  };

  const { error } = await supabase
    .from('skin_logs')
    .upsert(
      { user_id: profile.id, log_date: logDate, ...merged },
      { onConflict: 'user_id,log_date' },
    );

  if (error) return { error: 'Could not save. Try again.' };

  await Promise.all([
    syncTask(profile.id, logDate, 'skincare_am', merged.am_done),
    syncTask(profile.id, logDate, 'skincare_pm', merged.pm_done),
  ]);

  revalidatePath('/face');
  revalidatePath('/today');
  return {};
}

const drillInput = z.object({ done: z.boolean() });

/** §8.4: the neck and posture drills tick the neck_posture task. */
export async function setJawlineDrillsDone(input: unknown): Promise<FaceResult> {
  const parsed = drillInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  await syncTask(profile.id, logDate, 'neck_posture', parsed.data.done);

  revalidatePath('/face');
  revalidatePath('/today');
  return {};
}

/** Sets a daily task's completion from its template slug. */
async function syncTask(
  userId: string,
  logDate: string,
  slug: string,
  completed: boolean,
): Promise<void> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!template) return;

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id, target')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .eq('active', true)
    .maybeSingle();

  if (!task) return;

  await supabase
    .from('daily_logs')
    .update({
      completed,
      value: completed ? (task.target ?? 1) : 0,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('user_id', userId)
    .eq('user_task_id', task.id)
    .eq('log_date', logDate);
}
