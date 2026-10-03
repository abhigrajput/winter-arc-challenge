import type { ProfileRow } from '@/lib/supabase/types';
import { INPUT_STEPS, STEPS, type Step } from '@/lib/onboarding/schema';

/**
 * Progress is derived from which columns are filled, plus
 * profiles.onboarding_step for steps whose columns ship with a DB default
 * (see lib/onboarding/state.ts). Both live in the database, so resume works
 * across devices.
 *
 * Baseline measurements live in body_measurements, not profiles, so the caller
 * passes that separately.
 */

export interface ProgressInput {
  profile: Pick<
    ProfileRow,
    | 'username'
    | 'display_name'
    | 'timezone'
    | 'challenge_start'
    | 'sex'
    | 'age'
    | 'height_cm'
    | 'weight_kg'
    | 'target_weight_kg'
    | 'activity_level'
    | 'goal'
    | 'training_mode'
    | 'fitness_level'
    | 'days_per_week'
    | 'session_minutes'
    | 'diet_type'
    | 'budget'
    | 'wake_time'
    | 'sleep_target_h'
    | 'onboarded'
  > | null;
  /** True once a baseline row exists in body_measurements. */
  hasBaseline: boolean;
  /** True when Baseline was skipped (profiles.skipped_baseline). */
  skippedBaseline?: boolean;
  /** True once the user has passed the modules step, even by picking none. */
  modulesChosen: boolean;
}

/** A step counts as done when every column it writes is populated. */
export function isStepComplete(step: Step, input: ProgressInput): boolean {
  const p = input.profile;
  if (!p) return false;

  switch (step) {
    case 'identity':
      // The signup trigger sets a provisional user_<uuid8> username, which does
      // not count as claimed.
      return Boolean(
        p.username && !p.username.startsWith('user_') && p.display_name && p.timezone && p.challenge_start,
      );
    case 'body':
      return Boolean(
        p.sex && p.age && p.height_cm && p.weight_kg && p.target_weight_kg && p.activity_level,
      );
    case 'goal':
      return Boolean(p.goal);
    case 'modules':
      return input.modulesChosen;
    case 'training':
      return Boolean(p.training_mode);
    case 'schedule':
      return Boolean(p.fitness_level && p.days_per_week && p.session_minutes);
    case 'diet':
      return Boolean(p.diet_type && p.budget);
    case 'routine':
      return Boolean(p.wake_time && p.sleep_target_h);
    case 'baseline':
      // The step is optional: measured or explicitly skipped both count.
      return input.hasBaseline || Boolean(input.skippedBaseline);
    case 'result':
      return Boolean(p.onboarded);
  }
}

/** The step the user should land on: the first one not yet done. */
export function resumeStep(input: ProgressInput): Step {
  for (const step of INPUT_STEPS) {
    if (!isStepComplete(step, input)) return step;
  }
  return 'result';
}

/** Blocks deep-linking past unfinished steps. */
export function canEnterStep(step: Step, input: ProgressInput): boolean {
  const target = STEPS.indexOf(step);
  const resume = STEPS.indexOf(resumeStep(input));
  return target <= resume;
}

export function stepNumber(step: Step): number {
  return STEPS.indexOf(step) + 1;
}

export const TOTAL_STEPS = STEPS.length;
