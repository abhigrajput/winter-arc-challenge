import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import type { BodyMeasurementRow, ProfileRow } from '@/lib/supabase/types';
import { INPUT_STEPS, STEPS, type Step } from '@/lib/onboarding/schema';
import { isStepComplete, type ProgressInput } from '@/lib/onboarding/progress';

/**
 * Onboarding progress has two sources, and the furthest one wins.
 *
 * 1. Filled columns on profiles. Authoritative and device-independent, but
 *    blind to steps whose columns ship with a DB default — wake_time,
 *    sleep_target_h, budget and modules all arrive pre-populated from the
 *    signup trigger, so "still the default" is indistinguishable from "the
 *    user picked exactly that".
 * 2. A cookie recording the furthest step submitted. Covers the blind spot.
 *
 * Worst case (a different device, cleared cookies) the user is re-asked a step
 * they already answered, with their saved values pre-filled. Nothing is lost.
 *
 * The live schema has no onboarding_step column; adding one would let source 2
 * go away.
 */

export const PROGRESS_COOKIE = 'wa_onboarding';

export interface OnboardingState extends ProgressInput {
  userId: string;
  profile: ProfileRow;
  baseline: BodyMeasurementRow | null;
  resume: Step;
}

function cookieStepIndex(value: string | undefined): number {
  if (!value) return -1;
  const index = STEPS.indexOf(value as Step);
  return index;
}

export async function loadOnboardingState(userId: string): Promise<OnboardingState | null> {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const profileQuery = supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  const baselineQuery = supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('log_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  // Two independent reads — run them together.
  const [profileResult, baselineResult] = await Promise.all([profileQuery, baselineQuery]);
  const profile = profileResult.data as ProfileRow | null;
  const baseline = baselineResult.data as BodyMeasurementRow | null;

  if (!profile) return null;

  const reached = cookieStepIndex(cookieStore.get(PROGRESS_COOKIE)?.value);

  const progress: ProgressInput = {
    profile,
    hasBaseline: Boolean(baseline),
    // Picking zero add-on modules is a valid answer, so the array alone cannot
    // confirm the step was seen — the cookie or a later step does.
    modulesChosen:
      (profile.modules?.length ?? 0) > 0 ||
      Boolean(profile.training_mode) ||
      reached >= STEPS.indexOf('modules'),
  };

  // Done = its columns are filled, or the cookie says it was already submitted.
  const done = (step: Step) =>
    isStepComplete(step, progress) || reached >= STEPS.indexOf(step);

  const firstIncomplete = INPUT_STEPS.find((step) => !done(step));

  return {
    ...progress,
    userId,
    profile,
    baseline: baseline ?? null,
    resume: firstIncomplete ?? 'result',
  };
}

/** True when the user may open this step directly. */
export function canEnter(step: Step, state: OnboardingState): boolean {
  return STEPS.indexOf(step) <= STEPS.indexOf(state.resume);
}
