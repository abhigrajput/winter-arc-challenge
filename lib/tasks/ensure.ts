import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { DailyLogRow, ProfileRow, UserTaskRow } from '@/lib/supabase/types';
import { localDate } from '@/lib/calc/day';

/**
 * Idempotent setup for a user's checklist.
 *
 * user_tasks are seeded once from task_templates; daily_logs rows are created
 * lazily for the day being viewed. Both are safe to call on every page load —
 * they no-op once the rows exist.
 */

/** §9: tasks whose module the user did not pick are inserted inactive, not skipped. */
export async function ensureUserTasks(profile: ProfileRow): Promise<UserTaskRow[]> {
  const supabase = await createClient();

  const { data: existing, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', profile.id)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load tasks: ${error.message}`);
  if (existing && existing.length > 0) return existing;

  const { data: templates, error: templateError } = await supabase
    .from('task_templates')
    .select('*')
    .order('sort_order', { ascending: true });

  if (templateError) throw new Error(`Could not load task templates: ${templateError.message}`);
  if (!templates || templates.length === 0) return [];

  const chosen = new Set(profile.modules ?? []);

  const rows = templates.map((template) => ({
    user_id: profile.id,
    template_id: template.id,
    title: template.title,
    category: template.category,
    target: template.default_target,
    unit: template.unit,
    is_custom: false,
    active: template.module === 'core' || chosen.has(template.module as never),
    sort_order: template.sort_order,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('user_tasks')
    .insert(rows)
    .select();

  // A concurrent request may have seeded them first; re-read rather than fail.
  if (insertError) {
    const { data: retry } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('user_id', profile.id)
      .order('sort_order', { ascending: true });
    if (retry && retry.length > 0) return retry;
    throw new Error(`Could not create tasks: ${insertError.message}`);
  }

  return inserted ?? [];
}

/**
 * Creates the missing daily_logs rows for one local date, so the checklist has
 * something to toggle. Only active tasks get a row.
 */
export async function ensureDayLogs(
  userId: string,
  tasks: UserTaskRow[],
  logDate: string,
): Promise<DailyLogRow[]> {
  const supabase = await createClient();
  const activeIds = tasks.filter((t) => t.active).map((t) => t.id);

  const { data: existing, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate);

  if (error) throw new Error(`Could not load today: ${error.message}`);

  const logged = new Set((existing ?? []).map((log) => log.user_task_id));
  const missing = activeIds.filter((id) => !logged.has(id));

  if (missing.length === 0) return existing ?? [];

  const { error: insertError } = await supabase.from('daily_logs').insert(
    missing.map((taskId) => ({
      user_id: userId,
      user_task_id: taskId,
      log_date: logDate,
      completed: false,
      value: 0,
    })),
  );

  // 23505 means a parallel request won the race — that is fine.
  if (insertError && insertError.code !== '23505') {
    throw new Error(`Could not open today: ${insertError.message}`);
  }

  const { data: refreshed } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('log_date', logDate);

  return refreshed ?? [];
}

/** Everything /today needs, in one place. */
export interface TodayData {
  logDate: string;
  tasks: UserTaskRow[];
  logs: DailyLogRow[];
}

export async function loadToday(profile: ProfileRow, now: Date = new Date()): Promise<TodayData> {
  const logDate = localDate(profile.timezone ?? '', now);
  const tasks = await ensureUserTasks(profile);
  const logs = await ensureDayLogs(profile.id, tasks, logDate);

  return { logDate, tasks, logs };
}
