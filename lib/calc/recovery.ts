/**
 * Sleep and recovery (§8.7).
 *
 * Recovery is a 0-100 score built from four inputs: sleep hours, sleep
 * quality, soreness, and the previous day's training load. It is a rough
 * readiness signal for deciding how hard to train today, not a measurement.
 */

export const SLEEP_TARGET_MIN_HOURS = 7;
export const SLEEP_TARGET_MAX_HOURS = 9;

/** Weights sum to 100. */
const WEIGHTS = { sleepHours: 40, quality: 25, soreness: 20, load: 15 } as const;

export interface RecoveryInput {
  /** Hours slept last night. */
  sleepHours: number | null;
  /** Self-reported 1-5, matching the live CHECK constraint. */
  sleepQuality: number | null;
  /** Self-reported 1-5, where 5 is very sore. */
  soreness: number | null;
  /** Previous day's session RPE, 1-10. Null when there was no session. */
  previousSessionRpe: number | null;
}

export interface Recovery {
  /** 0-100, or null when there is nothing to score. */
  score: number | null;
  band: 'low' | 'moderate' | 'good' | 'unknown';
  /** What the user should do with it today. */
  advice: string;
  /** Which inputs were actually available. */
  inputsUsed: string[];
}

/**
 * Hours of sleep scored against the 7-9 hour target. Falls off either side:
 * too little is worse than too much, but 11 hours is not a win either.
 */
export function sleepHoursScore(hours: number): number {
  if (hours >= SLEEP_TARGET_MIN_HOURS && hours <= SLEEP_TARGET_MAX_HOURS) return 1;
  if (hours < SLEEP_TARGET_MIN_HOURS) {
    // 4 h scores 0, 7 h scores 1.
    return clamp01((hours - 4) / (SLEEP_TARGET_MIN_HOURS - 4));
  }
  // 9 h scores 1, 12 h scores 0.5 — oversleeping is a mild signal, not a failure.
  return clamp01(1 - (hours - SLEEP_TARGET_MAX_HOURS) / 6);
}

/**
 * Recovery score. Missing inputs are dropped and the remaining weights are
 * renormalised, so a user who logs only sleep still gets a usable number
 * rather than an artificially low one.
 */
export function recoveryScore(input: RecoveryInput): Recovery {
  const parts: { weight: number; value: number; label: string }[] = [];

  if (input.sleepHours !== null && input.sleepHours > 0) {
    parts.push({
      weight: WEIGHTS.sleepHours,
      value: sleepHoursScore(input.sleepHours),
      label: 'sleep hours',
    });
  }

  if (input.sleepQuality !== null) {
    parts.push({
      weight: WEIGHTS.quality,
      value: clamp01((input.sleepQuality - 1) / 4),
      label: 'sleep quality',
    });
  }

  if (input.soreness !== null) {
    // 1 = fresh scores 1; 5 = very sore scores 0.
    parts.push({
      weight: WEIGHTS.soreness,
      value: clamp01(1 - (input.soreness - 1) / 4),
      label: 'soreness',
    });
  }

  if (input.previousSessionRpe !== null) {
    // A hard session yesterday lowers readiness today.
    parts.push({
      weight: WEIGHTS.load,
      value: clamp01(1 - (input.previousSessionRpe - 1) / 9),
      label: 'yesterday’s session',
    });
  }

  if (parts.length === 0) {
    return {
      score: null,
      band: 'unknown',
      advice: 'Log your sleep to get a recovery score.',
      inputsUsed: [],
    };
  }

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  const weighted = parts.reduce((sum, p) => sum + p.weight * p.value, 0);
  const score = Math.round((weighted / totalWeight) * 100);

  return {
    score,
    band: band(score),
    advice: advice(score),
    inputsUsed: parts.map((p) => p.label),
  };
}

function band(score: number): 'low' | 'moderate' | 'good' {
  if (score < 50) return 'low';
  if (score < 75) return 'moderate';
  return 'good';
}

/** §8.7: a low score should visibly steer the user to a lighter session. */
function advice(score: number): string {
  if (score < 50) {
    return 'Go lighter today. Drop a set from each exercise, or make it technique work.';
  }
  if (score < 75) {
    return 'Train as planned, but stop a rep or two short on the hard sets.';
  }
  return 'Good to push. This is the day to chase the top of the rep range.';
}

/**
 * Hours between going to bed and waking, handling the overnight wrap.
 * Returns null for anything implausible rather than a misleading number.
 */
export function sleepDuration(bedTime: string, wakeTime: string): number | null {
  const [bedH, bedM] = parseTime(bedTime);
  const [wakeH, wakeM] = parseTime(wakeTime);
  if (bedH === null || wakeH === null) return null;

  const bedMinutes = bedH * 60 + (bedM ?? 0);
  const wakeMinutes = wakeH * 60 + (wakeM ?? 0);

  // Waking at or before bedtime means the night crossed midnight.
  const minutes = wakeMinutes > bedMinutes ? wakeMinutes - bedMinutes : wakeMinutes + 1440 - bedMinutes;
  const hours = Math.round((minutes / 60) * 10) / 10;

  if (hours <= 0 || hours > 16) return null;
  return hours;
}

function parseTime(value: string): [number | null, number | null] {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return [null, null];
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return [null, null];
  return [h, m];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
