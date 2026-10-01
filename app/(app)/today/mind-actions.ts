'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { localDate, shiftDate } from '@/lib/calc/day';
import { sleepDuration } from '@/lib/calc/recovery';

/**
 * Sleep (§8.7) and the mind, spirit and work trackers (§8.8).
 *
 * Kept apart from the checklist actions because these write their own tables
 * and then tick the matching task, rather than being task writes themselves.
 */

export interface MindResult {
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

const sleepInput = z.object({
  bedTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a bedtime.'),
  wakeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Pick a wake time.'),
  // The live CHECK constraint is 1-5, verified against the database.
  quality: z.coerce.number().int().min(1).max(5),
});

/**
 * §8.7 sleep log. The night is attributed to the day the user woke up, which
 * is what "last night's sleep" means on today's checklist.
 */
export async function saveSleepLog(_prev: MindResult, formData: FormData): Promise<MindResult> {
  const parsed = sleepInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check those times.' };
  }

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');
  const hours = sleepDuration(parsed.data.bedTime, parsed.data.wakeTime);

  if (hours === null) {
    return { error: 'That does not look like a night of sleep. Check the times.' };
  }

  // Timestamps are reconstructed around the wake date so the stored row keeps
  // the real clock times, not just the duration.
  const wakeStamp = `${logDate}T${parsed.data.wakeTime}:00`;
  const bedDate = parsed.data.bedTime > parsed.data.wakeTime ? shiftDate(logDate, -1) : logDate;
  const bedStamp = `${bedDate}T${parsed.data.bedTime}:00`;

  const { error } = await supabase.from('sleep_logs').upsert(
    {
      user_id: profile.id,
      log_date: logDate,
      bed_time: bedStamp,
      wake_time: wakeStamp,
      hours,
      quality: parsed.data.quality,
    },
    { onConflict: 'user_id,log_date' },
  );

  if (error) return { error: 'Could not save your sleep. Try again.' };

  // §9: the sleep task is "Sleep 7-9 h".
  await syncTask(profile.id, logDate, 'sleep', hours >= 7 && hours <= 9, hours);

  revalidatePath('/today');
  return {};
}

const gitaInput = z.object({
  chapter: z.coerce.number().int().min(1).max(18),
  verse: z.coerce.number().int().min(0).max(100).nullable().default(null),
  done: z.boolean(),
});

/** §8.8 Gita tracker: 18 chapters, with an optional verse marker. */
export async function saveGitaProgress(input: unknown): Promise<MindResult> {
  const parsed = gitaInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid chapter.' };

  const { supabase, profile } = await context();

  if (!parsed.data.done) {
    const { error } = await supabase
      .from('gita_progress')
      .delete()
      .eq('user_id', profile.id)
      .eq('chapter', parsed.data.chapter);

    if (error) return { error: 'Could not update. Try again.' };
    revalidatePath('/today');
    return {};
  }

  const { error } = await supabase.from('gita_progress').upsert(
    {
      user_id: profile.id,
      chapter: parsed.data.chapter,
      verse: parsed.data.verse,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,chapter' },
  );

  if (error) return { error: 'Could not save. Try again.' };

  revalidatePath('/today');
  return {};
}

const postInput = z.object({
  // The live CHECK constraint allows exactly these three.
  platform: z.enum(['youtube', 'instagram', 'other']),
  title: z.string().trim().min(1, 'Give it a title.').max(120),
  url: z
    .union([z.string().trim().url('That is not a valid link.'), z.literal('')])
    .optional()
    .transform((v) => (v ? v : null)),
});

/** §8.8 content tracker: one row per published post. */
export async function logContentPost(_prev: MindResult, formData: FormData): Promise<MindResult> {
  const parsed = postInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the post details.' };
  }

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  const { error } = await supabase.from('content_posts').insert({
    user_id: profile.id,
    log_date: logDate,
    platform: parsed.data.platform,
    title: parsed.data.title,
    url: parsed.data.url,
  });

  if (error) return { error: 'Could not save that post. Try again.' };

  await syncTask(profile.id, logDate, 'content', true, 1);

  revalidatePath('/today');
  return {};
}

const deletePostInput = z.object({ postId: z.string().uuid() });

export async function deleteContentPost(input: unknown): Promise<MindResult> {
  const parsed = deletePostInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();
  const logDate = localDate(profile.timezone ?? '');

  const { error } = await supabase
    .from('content_posts')
    .delete()
    .eq('id', parsed.data.postId)
    .eq('user_id', profile.id);

  if (error) return { error: 'Could not remove that. Try again.' };

  const { count } = await supabase
    .from('content_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('log_date', logDate);

  await syncTask(profile.id, logDate, 'content', (count ?? 0) > 0, count ?? 0);

  revalidatePath('/today');
  return {};
}

/** Sets a daily task's completion from its template slug. */
async function syncTask(
  userId: string,
  logDate: string,
  slug: string,
  completed: boolean,
  value: number,
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
