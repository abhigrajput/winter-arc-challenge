import type { Metadata } from 'next';
import { requireUser } from '@/lib/profile';
import { ensureUserTasks } from '@/lib/tasks/ensure';
import { effectiveModules, goalPreset } from '@/lib/goals';
import { MODULE_SLUGS } from '@/lib/onboarding/schema';
import { AddTask } from '@/components/tasks/add-task';
import {
  GoalPresetButton,
  TaskManager,
  type ManagedModule,
  type ManagedTask,
} from '@/components/tasks/task-manager';
import { applyGoalPreset } from './actions';

export const metadata: Metadata = { title: 'Tasks' };
export const dynamic = 'force-dynamic';

const MODULE_COPY: Record<string, { label: string; description: string }> = {
  abs: { label: 'Abs', description: 'Ab circuits and the Abs ETA card.' },
  face_skin: { label: 'Skin', description: 'AM/PM routine, breakout log, correlations.' },
  jawline: { label: 'Jawline', description: 'Neck work, posture drills, face photos.' },
  running: { label: 'Running', description: 'Distance tracking as a daily task.' },
  content_creator: { label: 'Content', description: 'Posts published and editing time.' },
};

export default async function TasksPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const tasks = await ensureUserTasks(profile);
  const preset = goalPreset(profile.goal);
  const chosen = new Set(profile.modules ?? []);
  const forced = new Set(preset.forcedModules);
  const inPlay = effectiveModules(profile.goal, profile.modules);

  const managedTasks: ManagedTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title ?? '',
    category: task.category ?? 'discipline',
    target: Number(task.target ?? 0),
    unit: task.unit ?? 'check',
    active: Boolean(task.active),
    isCustom: Boolean(task.is_custom),
  }));

  const modules: ManagedModule[] = MODULE_SLUGS.map((slug) => ({
    slug,
    label: MODULE_COPY[slug]?.label ?? slug,
    description: MODULE_COPY[slug]?.description ?? '',
    enabled: chosen.has(slug) || inPlay.has(slug),
    locked: forced.has(slug),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="label-xs">Setup</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Switch anything off, change any target, add your own. Turning a task off clears it from
          today onward — days you have already earned stay as they were.
        </p>
      </header>

      <GoalPresetButton summary={preset.summary} action={applyGoalPreset} />

      <TaskManager tasks={managedTasks} modules={modules} />

      <AddTask />
    </div>
  );
}
