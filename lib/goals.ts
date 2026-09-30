import type { ModuleSlug, PrimaryGoal } from '@/lib/supabase/types';

/**
 * Goal presets (§9). A preset adjusts the seeded task list for the goal the
 * user picked: different targets, some modules forced on, the odd task
 * reworded or made optional.
 *
 * Presets are defaults, not rules. Every target stays editable from /tasks and
 * nothing here overrides a value the user has set by hand.
 */

/** The 24 seeded template slugs. */
export const TASK_SLUGS = [
  'wake_5am',
  'no_phone_morning',
  'surya_namaskar',
  'workout',
  'abs_circuit',
  'pullups',
  'steps',
  'running',
  'water',
  'protein',
  'calories',
  'no_junk',
  'sleep',
  'skincare_am',
  'skincare_pm',
  'neck_posture',
  'social_limit',
  'reading',
  'gita',
  'temple',
  'meditation',
  'content',
  'editing',
  'skill',
] as const;

export type TaskSlug = (typeof TASK_SLUGS)[number];

export interface GoalPreset {
  label: string;
  /** One line explaining what the goal changes. */
  summary: string;
  /** Target overrides, by template slug. */
  targets: Partial<Record<TaskSlug, number>>;
  /** Modules this goal switches on regardless of what was picked. */
  forcedModules: readonly ModuleSlug[];
  /** Reworded task titles. */
  titles: Partial<Record<TaskSlug, string>>;
  /** Core tasks this goal treats as optional, so they seed inactive. */
  optional: readonly TaskSlug[];
}

const EMPTY = { targets: {}, forcedModules: [], titles: {}, optional: [] } as const;

/**
 * §9. Where the spec gives a range (fat loss steps 12000-15000) the lower end
 * is the default — it is the one someone actually hits on day 1, and it is
 * editable.
 */
export const GOAL_PRESETS: Record<PrimaryGoal, GoalPreset> = {
  fat_loss: {
    ...EMPTY,
    label: 'Fat loss',
    summary: 'Steps up to 12,000. Abs module on.',
    targets: { steps: 12000 },
    forcedModules: ['abs'],
  },
  six_pack: {
    ...EMPTY,
    label: 'Six pack',
    summary: 'Steps up to 12,000. Abs module on.',
    targets: { steps: 12000 },
    forcedModules: ['abs'],
  },
  lean_bulk: {
    ...EMPTY,
    label: 'Lean bulk',
    summary: 'Steps down to 8,000. Running optional. Junk rule relaxed.',
    targets: { steps: 8000 },
    titles: { no_junk: 'No junk before training' },
    optional: ['running'],
  },
  recomp: {
    ...EMPTY,
    label: 'Recomp',
    summary: 'Steps at 10,000.',
    targets: { steps: 10000 },
  },
  discipline: {
    ...EMPTY,
    label: 'Discipline',
    summary: 'Template defaults. Habits are the point.',
  },
  spiritual: {
    ...EMPTY,
    label: 'Spiritual',
    summary: 'Template defaults. Mind and practice first.',
  },
};

export function goalPreset(goal: PrimaryGoal | null): GoalPreset {
  if (!goal) return { ...EMPTY, label: 'No goal', summary: 'Template defaults.' };
  return GOAL_PRESETS[goal];
}

/** The modules actually in play: what the user picked, plus what the goal forces. */
export function effectiveModules(
  goal: PrimaryGoal | null,
  chosen: readonly string[] | null,
): Set<string> {
  return new Set([...(chosen ?? []), ...goalPreset(goal).forcedModules]);
}

export interface TemplateShape {
  slug: string;
  title: string;
  module: string;
  default_target: number;
}

export interface ResolvedTask {
  title: string;
  target: number;
  active: boolean;
}

/**
 * Resolves one template into the task row to seed, applying the goal preset.
 * A task is active when its module is in play and the goal has not marked it
 * optional.
 */
export function resolveTask(
  template: TemplateShape,
  goal: PrimaryGoal | null,
  chosenModules: readonly string[] | null,
): ResolvedTask {
  const preset = goalPreset(goal);
  const slug = template.slug as TaskSlug;
  const modules = effectiveModules(goal, chosenModules);

  const inPlay = template.module === 'core' || modules.has(template.module);
  const optional = preset.optional.includes(slug);

  return {
    title: preset.titles[slug] ?? template.title,
    target: preset.targets[slug] ?? template.default_target,
    active: inPlay && !optional,
  };
}
