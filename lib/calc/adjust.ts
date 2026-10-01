import type { PrimaryGoal, Sex } from '@/lib/supabase/types';
import { MAX_WEEKLY_LOSS_FRACTION, clampCalories } from '@/lib/calc/guardrails';

/**
 * Weekly calorie auto-adjust (§6).
 *
 *   fat loss  — losing too fast  → +150 kcal
 *   fat loss  — stalled 2 weeks  → -150 kcal
 *   lean bulk — gaining too fast → -100 kcal
 *
 * The suggestion is always re-clamped by the §10 guardrails, so an adjustment
 * can never push a target below the calorie floor or past the 1%/week cap.
 */

export const ADJUST_FAST_LOSS_KCAL = 150;
export const ADJUST_STALL_KCAL = -150;
export const ADJUST_FAST_GAIN_KCAL = -100;

/** Below this weekly change, nothing is really moving. */
export const STALL_THRESHOLD_KG = 0.1;

/** §6 lean bulk target: 0.25-0.5 kg per week. */
export const BULK_MAX_WEEKLY_GAIN_KG = 0.5;

export interface AdjustInput {
  goal: PrimaryGoal;
  sex: Sex;
  age: number;
  weightKg: number;
  /** Current daily target. */
  currentCalories: number;
  /** Maintenance, for the guardrail clamp. */
  maintenanceCalories: number;
  /** Signed kg change over the last 7 days. Negative means losing. */
  weeklyChangeKg: number | null;
  /** Signed kg change over the week before that, for spotting a stall. */
  previousWeeklyChangeKg: number | null;
}

export interface AdjustResult {
  /** Signed kcal change to apply. 0 when nothing should change. */
  deltaKcal: number;
  /** The new daily target after guardrails. */
  newCalories: number;
  /** Plain-language reason, shown to the user. */
  reason: string;
  /** Guardrails that altered the result, if any. */
  applied: string[];
}

export function autoAdjustCalories(input: AdjustInput): AdjustResult {
  const {
    goal,
    sex,
    age,
    weightKg,
    currentCalories,
    maintenanceCalories,
    weeklyChangeKg,
    previousWeeklyChangeKg,
  } = input;

  const hold = (reason: string): AdjustResult => {
    const clamped = clampCalories({
      calories: currentCalories,
      maintenance: maintenanceCalories,
      sex,
      age,
      weightKg,
    });
    return { deltaKcal: 0, newCalories: clamped.calories, reason, applied: clamped.applied };
  };

  if (weeklyChangeKg === null) {
    return hold('Not enough weight data this week. Target unchanged.');
  }

  const cutting = goal === 'fat_loss' || goal === 'six_pack';
  const bulking = goal === 'lean_bulk';

  // Maintenance goals are not steered by the scale.
  if (!cutting && !bulking) {
    return hold('Your goal is not driven by the scale, so the target stays put.');
  }

  let delta = 0;
  let reason = '';

  if (cutting) {
    const maxWeeklyLoss = weightKg * MAX_WEEKLY_LOSS_FRACTION;

    if (weeklyChangeKg < -maxWeeklyLoss) {
      delta = ADJUST_FAST_LOSS_KCAL;
      reason = `Losing ${Math.abs(weeklyChangeKg).toFixed(1)} kg a week is faster than is useful. Eating a little more protects muscle.`;
    } else if (
      Math.abs(weeklyChangeKg) < STALL_THRESHOLD_KG &&
      previousWeeklyChangeKg !== null &&
      Math.abs(previousWeeklyChangeKg) < STALL_THRESHOLD_KG
    ) {
      delta = ADJUST_STALL_KCAL;
      reason = 'Two flat weeks. A small cut gets things moving again.';
    } else {
      reason = 'Rate looks right. Hold the target.';
    }
  }

  if (bulking) {
    if (weeklyChangeKg > BULK_MAX_WEEKLY_GAIN_KG) {
      delta = ADJUST_FAST_GAIN_KCAL;
      reason = `Gaining ${weeklyChangeKg.toFixed(1)} kg a week is mostly fat. Easing off keeps it lean.`;
    } else if (
      weeklyChangeKg < STALL_THRESHOLD_KG &&
      previousWeeklyChangeKg !== null &&
      previousWeeklyChangeKg < STALL_THRESHOLD_KG
    ) {
      delta = ADJUST_FAST_LOSS_KCAL;
      reason = 'Two weeks without gaining. A small increase restarts progress.';
    } else {
      reason = 'Rate looks right. Hold the target.';
    }
  }

  const clamped = clampCalories({
    calories: currentCalories + delta,
    maintenance: maintenanceCalories,
    sex,
    age,
    weightKg,
  });

  return {
    // Report the delta that actually landed, after guardrails.
    deltaKcal: clamped.calories - currentCalories,
    newCalories: clamped.calories,
    reason,
    applied: clamped.applied,
  };
}

/** Caps any AI-suggested adjustment to the §6 range before it is applied. */
export function boundSuggestedAdjustment(suggested: number): number {
  const max = ADJUST_FAST_LOSS_KCAL;
  const min = ADJUST_STALL_KCAL;
  if (!Number.isFinite(suggested)) return 0;
  return Math.round(Math.min(max, Math.max(min, suggested)));
}

/**
 * Reconciles the deterministic §6 adjustment with whatever the model suggested.
 *
 * §6 is authoritative: the model may propose a smaller change in the same
 * direction, but never a larger one, and never the opposite direction. This is
 * what stops a confident model from talking the app into a bigger cut.
 */
export function reconcileAdjustment(ruleDelta: number, modelDelta: number): number {
  if (ruleDelta === 0) return 0;
  if (modelDelta === 0) return ruleDelta;
  if (Math.sign(modelDelta) !== Math.sign(ruleDelta)) return ruleDelta;
  return Math.sign(ruleDelta) * Math.min(Math.abs(ruleDelta), Math.abs(modelDelta));
}
