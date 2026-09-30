import type { PrimaryGoal } from '@/lib/supabase/types';
import { KCAL_PER_KG } from '@/lib/calc/guardrails';

/**
 * 90-day weight projection. §5 result screen.
 *
 * Energy balance only: it assumes the calorie target is actually hit every day
 * and says nothing about body composition. Always shown as a range and always
 * labelled an estimate.
 */

export const CHALLENGE_DAYS = 90;
const DAYS_PER_WEEK = 7;

/** Real-world adherence and metabolic adaptation blunt the maths in both directions. */
const OPTIMISTIC = 1.0;
const CONSERVATIVE = 0.7;

export interface ProjectionInput {
  weightKg: number;
  /** Guardrailed daily calorie target. */
  calorieTarget: number;
  /** TDEE at the current weight. */
  maintenance: number;
  goal: PrimaryGoal;
  days?: number;
}

export interface Projection {
  /** Signed kg per week at the target intake. Negative means losing. */
  weeklyRateKg: number;
  /** Weight at the end of the window, slower end of the range. */
  conservativeKg: number;
  /** Weight at the end of the window, if adherence is perfect. */
  optimisticKg: number;
  /** Ordered low..high for display. */
  lowKg: number;
  highKg: number;
  totalChangeKg: number;
  days: number;
  /** True when the goal is maintenance, so no change is projected. */
  maintenance: boolean;
}

/**
 * Projects weight at day 90 from the daily energy gap.
 * A maintenance goal projects no change rather than a fake range.
 */
export function projectWeight({
  weightKg,
  calorieTarget,
  maintenance,
  goal,
  days = CHALLENGE_DAYS,
}: ProjectionInput): Projection {
  const dailyGap = calorieTarget - maintenance;
  const weeks = days / DAYS_PER_WEEK;
  const isMaintenance = goal === 'discipline' || goal === 'spiritual' || dailyGap === 0;

  if (isMaintenance) {
    return {
      weeklyRateKg: 0,
      conservativeKg: round1(weightKg),
      optimisticKg: round1(weightKg),
      lowKg: round1(weightKg),
      highKg: round1(weightKg),
      totalChangeKg: 0,
      days,
      maintenance: true,
    };
  }

  const weeklyRateKg = (dailyGap * DAYS_PER_WEEK) / KCAL_PER_KG;
  const fullChange = weeklyRateKg * weeks;

  const optimisticKg = weightKg + fullChange * OPTIMISTIC;
  const conservativeKg = weightKg + fullChange * CONSERVATIVE;

  return {
    weeklyRateKg: round2(weeklyRateKg),
    conservativeKg: round1(conservativeKg),
    optimisticKg: round1(optimisticKg),
    lowKg: round1(Math.min(optimisticKg, conservativeKg)),
    highKg: round1(Math.max(optimisticKg, conservativeKg)),
    totalChangeKg: round1(fullChange),
    days,
    maintenance: false,
  };
}

/**
 * Weeks to reach a target body fat at the current rate of loss, as a range.
 * Powers the "Abs ETA" card (§8.2). Returns null when the rate moves away from
 * the target — no fake ETA for someone who is not losing.
 */
export function weeksToBodyFat(
  currentBodyFat: number,
  targetBodyFat: number,
  weeklyRateKg: number,
  weightKg: number,
): { low: number; high: number } | null {
  if (currentBodyFat <= targetBodyFat) return null;
  if (weeklyRateKg >= 0) return null;

  const fatMassToLose = ((currentBodyFat - targetBodyFat) / 100) * weightKg;
  // Some of the loss is lean tissue; 75-100% coming from fat is a fair band.
  const optimisticWeeks = fatMassToLose / Math.abs(weeklyRateKg);
  const conservativeWeeks = optimisticWeeks / 0.75;

  return {
    low: Math.max(1, Math.round(optimisticWeeks)),
    high: Math.max(1, Math.round(conservativeWeeks)),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
