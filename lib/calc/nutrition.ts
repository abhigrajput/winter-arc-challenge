/**
 * Nutrition totals and ring progress (§8.5).
 *
 * Pure functions only — the hard rule in §4 keeps every number out of the
 * components.
 */

export interface MacroTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FoodRow {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
}

export const EMPTY_TOTALS: MacroTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

export function sumEntries(entries: FoodRow[]): MacroTotals {
  const totals = { ...EMPTY_TOTALS };

  for (const entry of entries) {
    totals.calories += entry.calories ?? 0;
    totals.proteinG += Number(entry.protein_g ?? 0);
    totals.carbsG += Number(entry.carbs_g ?? 0);
    totals.fatG += Number(entry.fat_g ?? 0);
  }

  return {
    calories: Math.round(totals.calories),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
  };
}

export interface Ring {
  consumed: number;
  target: number;
  /** 0-100, clamped, for the arc. */
  percent: number;
  /** Signed: negative once the target is passed. */
  remaining: number;
  hit: boolean;
  /** Only meaningful for calories, where overshooting matters. */
  over: boolean;
}

/** One ring's state. A zero or missing target reads as 0% rather than NaN. */
export function ring(consumed: number, target: number | null | undefined): Ring {
  const goal = target && target > 0 ? target : 0;
  const percent = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;

  return {
    consumed: Math.round(consumed),
    target: goal,
    percent,
    remaining: Math.round(goal - consumed),
    hit: goal > 0 && consumed >= goal,
    over: goal > 0 && consumed > goal,
  };
}

/**
 * §6 allows a band around the calorie target rather than a single number;
 * "in range" is what the daily calories task checks.
 */
export const CALORIE_BAND = 100;

export function caloriesInRange(
  consumed: number,
  target: number | null | undefined,
  band = CALORIE_BAND,
): boolean {
  if (!target || target <= 0) return false;
  return consumed >= target - band && consumed <= target + band;
}

/** Litres, for display. Water is stored in millilitres. */
export function toLitres(ml: number): number {
  return Math.round((ml / 1000) * 10) / 10;
}
