/**
 * How a numeric task decides it is done.
 *
 * Most minute-based tasks are floors: do at least the target. One is a cap —
 * "Social media under 30 min" (§9) is satisfied by staying BELOW its target,
 * so the usual `value >= target` rule is backwards for it.
 */

/** Template slugs where a lower number is the goal. */
export const CAP_TASK_SLUGS = new Set(['social_limit']);

export function isCapTask(slug: string | null | undefined): boolean {
  return slug !== null && slug !== undefined && CAP_TASK_SLUGS.has(slug);
}

/**
 * Whether a numeric task counts as complete.
 *
 * A cap task starts the day complete — you have not broken the limit yet — and
 * only fails once the logged value goes past the target.
 */
export function isNumericTaskComplete(
  value: number,
  target: number,
  slug: string | null | undefined,
): boolean {
  if (target <= 0) return false;
  return isCapTask(slug) ? value <= target : value >= target;
}

/**
 * How full the bar is, 0-100. For a cap task this reads as the limit being
 * used up rather than progress toward a goal, which is the same shape.
 */
export function numericTaskPercent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round(Math.min(1, value / target) * 100);
}
