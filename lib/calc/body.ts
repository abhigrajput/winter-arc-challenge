/**
 * Body tracking maths (§8.6).
 *
 * Daily scale weight is mostly noise — water, food volume, salt, sleep. The
 * 7-day moving average is the number worth looking at, so it is what the chart
 * and the trend both use.
 */

export const MOVING_AVERAGE_DAYS = 7;

export interface WeighIn {
  /** ISO yyyy-MM-dd. */
  date: string;
  weightKg: number;
}

export interface TrendPoint {
  date: string;
  weightKg: number;
  /** Null until there is at least one reading in the window. */
  averageKg: number | null;
}

/**
 * Trailing average over the preceding `window` days, by date rather than by
 * row count — a gap in logging should widen the window, not skip over it.
 */
export function movingAverage(
  readings: WeighIn[],
  window = MOVING_AVERAGE_DAYS,
): TrendPoint[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((reading, index) => {
    const cutoff = shiftIso(reading.date, -(window - 1));
    let sum = 0;
    let count = 0;

    for (let i = index; i >= 0; i -= 1) {
      const candidate = sorted[i]!;
      if (candidate.date < cutoff) break;
      sum += candidate.weightKg;
      count += 1;
    }

    return {
      date: reading.date,
      weightKg: reading.weightKg,
      averageKg: count > 0 ? round1(sum / count) : null,
    };
  });
}

export interface WeightTrend {
  /** Latest 7-day average. */
  currentKg: number | null;
  /** Average from a week earlier, for comparison. */
  previousKg: number | null;
  /** Signed change, kg per week. Negative means losing. */
  weeklyChangeKg: number | null;
  direction: 'down' | 'up' | 'flat' | 'unknown';
  /** How many separate days have a reading. */
  readings: number;
}

/** Compares the latest average with the one a week before it. */
export function weightTrend(readings: WeighIn[], window = MOVING_AVERAGE_DAYS): WeightTrend {
  const points = movingAverage(readings, window);

  if (points.length === 0) {
    return {
      currentKg: null,
      previousKg: null,
      weeklyChangeKg: null,
      direction: 'unknown',
      readings: 0,
    };
  }

  const latest = points[points.length - 1]!;
  const weekAgoDate = shiftIso(latest.date, -window);

  // The most recent point at or before a week ago.
  const earlier = [...points].reverse().find((p) => p.date <= weekAgoDate);

  if (!earlier?.averageKg || !latest.averageKg) {
    return {
      currentKg: latest.averageKg,
      previousKg: earlier?.averageKg ?? null,
      weeklyChangeKg: null,
      direction: 'unknown',
      readings: points.length,
    };
  }

  const change = round1(latest.averageKg - earlier.averageKg);

  return {
    currentKg: latest.averageKg,
    previousKg: earlier.averageKg,
    weeklyChangeKg: change,
    direction: change < -0.1 ? 'down' : change > 0.1 ? 'up' : 'flat',
    readings: points.length,
  };
}

export interface MeasurementSet {
  waistCm?: number | null;
  chestCm?: number | null;
  armCm?: number | null;
  thighCm?: number | null;
  neckCm?: number | null;
  hipCm?: number | null;
}

export interface MeasurementDelta {
  key: keyof MeasurementSet;
  label: string;
  latest: number;
  first: number;
  changeCm: number;
}

const MEASUREMENT_LABELS: [keyof MeasurementSet, string][] = [
  ['waistCm', 'Waist'],
  ['chestCm', 'Chest'],
  ['armCm', 'Arm'],
  ['thighCm', 'Thigh'],
  ['neckCm', 'Neck'],
  ['hipCm', 'Hip'],
];

/** Change from the first recorded measurement to the latest, where both exist. */
export function measurementDeltas(
  first: MeasurementSet,
  latest: MeasurementSet,
): MeasurementDelta[] {
  const deltas: MeasurementDelta[] = [];

  for (const [key, label] of MEASUREMENT_LABELS) {
    const a = first[key];
    const b = latest[key];
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    deltas.push({ key, label, first: a, latest: b, changeCm: round1(b - a) });
  }

  return deltas;
}

function shiftIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
