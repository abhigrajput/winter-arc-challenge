/**
 * Progressive overload and personal records. §6 and §8.1.
 *
 * Weighted lifts are compared by estimated 1RM (Epley); bodyweight lifts by
 * reps in a single set, because adding reps is the only load available.
 */

/** Gym: top of the rep range on every set earns this jump next session. */
export const BARBELL_INCREMENT_KG = 2.5;

export interface LoggedSet {
  reps: number | null;
  weight_kg: number | null;
  rpe?: number | null;
}

/**
 * Epley estimated one-rep max: w * (1 + reps/30).
 * Accurate enough up to about 10 reps; beyond that it flatters the lifter, so
 * treat it as a trend line rather than a true max.
 */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return round1(weightKg);
  return round1(weightKg * (1 + reps / 30));
}

/** Best estimated 1RM across a set of sets. 0 when nothing usable was logged. */
export function bestEstimated1RM(sets: LoggedSet[]): number {
  let best = 0;
  for (const set of sets) {
    const value = epley1RM(set.weight_kg ?? 0, set.reps ?? 0);
    if (value > best) best = value;
  }
  return best;
}

/** Most reps in any single set. Used for bodyweight PRs. */
export function bestReps(sets: LoggedSet[]): number {
  let best = 0;
  for (const set of sets) {
    const reps = set.reps ?? 0;
    if (reps > best) best = reps;
  }
  return best;
}

/** Total weight moved, kg. Bodyweight sets contribute nothing here. */
export function sessionVolume(sets: LoggedSet[]): number {
  let volume = 0;
  for (const set of sets) {
    volume += (set.weight_kg ?? 0) * (set.reps ?? 0);
  }
  return Math.round(volume);
}

export interface PrCheck {
  /** True when this session beat the previous best. */
  isPr: boolean;
  /** The metric that improved, for the summary copy. */
  metric: 'estimated_1rm' | 'reps' | null;
  current: number;
  previous: number;
}

/**
 * Compares this session's sets for one exercise against the best previously
 * recorded. A first-ever logged set counts as a PR — it is a new best by
 * definition, and it is the moment worth marking.
 */
export function detectPr(
  sets: LoggedSet[],
  previousBest: number,
  isBodyweight: boolean,
): PrCheck {
  const current = isBodyweight ? bestReps(sets) : bestEstimated1RM(sets);
  const metric = isBodyweight ? ('reps' as const) : ('estimated_1rm' as const);

  if (current <= 0) return { isPr: false, metric: null, current: 0, previous: previousBest };

  return {
    isPr: current > previousBest,
    metric,
    current,
    previous: previousBest,
  };
}

export interface OverloadSuggestion {
  /** True when every working set hit the top of the range. */
  earned: boolean;
  /** Next session's load, kg. Null for bodyweight work. */
  nextWeightKg: number | null;
  /** Plain-language instruction for the UI. */
  advice: string;
}

/**
 * §6 progressive overload: hit the top of the rep range on all sets and the
 * load goes up next session (+2.5 kg on a bar), or you move to the next
 * progression step for bodyweight work.
 */
export function suggestOverload({
  sets,
  repRangeTop,
  isBodyweight,
  nextProgressionName,
  incrementKg = BARBELL_INCREMENT_KG,
}: {
  sets: LoggedSet[];
  repRangeTop: number;
  isBodyweight: boolean;
  nextProgressionName?: string | null;
  incrementKg?: number;
}): OverloadSuggestion {
  const working = sets.filter((s) => (s.reps ?? 0) > 0);

  if (working.length === 0) {
    return { earned: false, nextWeightKg: null, advice: 'Log a set to get a suggestion.' };
  }

  const allAtTop = working.every((s) => (s.reps ?? 0) >= repRangeTop);

  if (!allAtTop) {
    return {
      earned: false,
      nextWeightKg: null,
      advice: `Stay here until every set hits ${repRangeTop} reps.`,
    };
  }

  if (isBodyweight) {
    return {
      earned: true,
      nextWeightKg: null,
      advice: nextProgressionName
        ? `Move up to ${nextProgressionName} next session.`
        : 'Add reps or slow the tempo — you are at the top of this progression.',
    };
  }

  const heaviest = Math.max(...working.map((s) => s.weight_kg ?? 0));
  if (heaviest <= 0) {
    return { earned: true, nextWeightKg: null, advice: 'Add load next session.' };
  }

  const next = round1(heaviest + incrementKg);
  return {
    earned: true,
    nextWeightKg: next,
    advice: `Go up to ${next} kg next session.`,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
