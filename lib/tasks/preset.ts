import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { PrimaryGoal } from '@/lib/supabase/types';
import { resolveTask } from '@/lib/goals';

/**
 * Applies a goal preset to the tasks a user already has.
 *
 * This exists because the live database seeds all 24 user_tasks by trigger the
 * moment a user signs up — before onboarding has asked for a goal or modules.
 * Those rows therefore carry raw template defaults and have every add-on module
 * switched off. Reconciling afterwards is what makes §9 actually hold.
 *
 * Idempotent, and it never touches custom tasks.
 */
export async function applyGoalPresetToTasks(
  userId: string,
  goal: PrimaryGoal | null,
  modules: readonly string[] | null,
): Promise<{ updated: number }> {
  const supabase = await createClient();

  const [{ data: templates }, { data: tasks }] = await Promise.all([
    supabase.from('task_templates').select('*'),
    supabase
      .from('user_tasks')
      .select('id, template_id, title, target, active')
      .eq('user_id', userId)
      .eq('is_custom', false),
  ]);

  if (!templates || !tasks) return { updated: 0 };

  const byId = new Map(templates.map((t) => [t.id, t]));
  let updated = 0;

  for (const task of tasks) {
    const template = task.template_id === null ? undefined : byId.get(task.template_id);
    if (!template) continue;

    const resolved = resolveTask(
      {
        slug: template.slug ?? '',
        title: template.title ?? '',
        module: template.module ?? 'core',
        default_target: Number(template.default_target ?? 0),
      },
      goal,
      modules,
    );

    const unchanged =
      task.title === resolved.title &&
      Number(task.target) === resolved.target &&
      Boolean(task.active) === resolved.active;

    if (unchanged) continue;

    const { error } = await supabase
      .from('user_tasks')
      .update({ title: resolved.title, target: resolved.target, active: resolved.active })
      .eq('id', task.id)
      .eq('user_id', userId);

    if (!error) updated += 1;
  }

  // Tasks switched off keep their log row for today — the live database has no
  // DELETE policy on daily_logs — but lib/calc/streak.ts leaves inactive tasks
  // out of the current day's totals, so the day stays finishable.
  return { updated };
}
