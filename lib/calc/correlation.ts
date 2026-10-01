/**
 * Correlation for the §8.3 skin card.
 *
 * This is a descriptive statistic on a handful of self-reported days, not
 * evidence. Everything here is built to under-claim: weak relationships are
 * reported as "no clear link", and nothing is shown at all below a minimum
 * number of paired days. The UI must label it "correlation, not proof".
 */

/** Below this many paired days, the number means nothing. */
export const MIN_PAIRS = 7;

export interface Pair {
  x: number;
  y: number;
}

/** Pearson's r. Null when undefined (no variance, or too few points). */
export function pearson(pairs: Pair[]): number | null {
  if (pairs.length < 2) return null;

  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.y, 0) / n;

  let covariance = 0;
  let varianceX = 0;
  let varianceY = 0;

  for (const { x, y } of pairs) {
    const dx = x - meanX;
    const dy = y - meanY;
    covariance += dx * dy;
    varianceX += dx * dx;
    varianceY += dy * dy;
  }

  // A flat series has no correlation to report, not a correlation of zero.
  if (varianceX === 0 || varianceY === 0) return null;

  const r = covariance / Math.sqrt(varianceX * varianceY);
  return Math.round(r * 100) / 100;
}

export type Strength = 'none' | 'weak' | 'moderate' | 'strong';

export function strength(r: number | null): Strength {
  if (r === null) return 'none';
  const magnitude = Math.abs(r);
  if (magnitude < 0.3) return 'none';
  if (magnitude < 0.5) return 'weak';
  if (magnitude < 0.7) return 'moderate';
  return 'strong';
}

export interface CorrelationResult {
  /** Pearson's r, or null when it cannot be computed. */
  r: number | null;
  pairs: number;
  strength: Strength;
  /** True once there are enough paired days to show anything. */
  enoughData: boolean;
  /** Plain-language summary, deliberately hedged. */
  summary: string;
}

export interface CorrelationInput {
  pairs: Pair[];
  /** What x is, e.g. "sleep". */
  factorLabel: string;
  /** Wording for the direction, since lower is better for breakouts. */
  higherFactorMeans?: { more: string; fewer: string };
}

/**
 * Correlates one factor against breakout score. Phrased so a user cannot read
 * it as cause and effect.
 */
export function correlate({
  pairs,
  factorLabel,
  higherFactorMeans = { more: 'more breakouts', fewer: 'fewer breakouts' },
}: CorrelationInput): CorrelationResult {
  const r = pearson(pairs);
  const level = strength(r);
  const enoughData = pairs.length >= MIN_PAIRS;

  if (!enoughData) {
    return {
      r,
      pairs: pairs.length,
      strength: level,
      enoughData: false,
      summary: `Needs ${MIN_PAIRS - pairs.length} more day${
        MIN_PAIRS - pairs.length === 1 ? '' : 's'
      } of data.`,
    };
  }

  if (r === null || level === 'none') {
    return {
      r,
      pairs: pairs.length,
      strength: 'none',
      enoughData: true,
      summary: `No clear link with ${factorLabel} in your data so far.`,
    };
  }

  const direction = r > 0 ? higherFactorMeans.more : higherFactorMeans.fewer;
  return {
    r,
    pairs: pairs.length,
    strength: level,
    enoughData: true,
    summary: `A ${level} pattern: higher ${factorLabel} lines up with ${direction}.`,
  };
}

/** Fixed wording required by §8.3. */
export const CORRELATION_DISCLAIMER = 'Correlation, not proof.';
