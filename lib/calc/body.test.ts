import { describe, expect, it } from 'vitest';
import { measurementDeltas, movingAverage, weightTrend } from './body';

const w = (date: string, weightKg: number) => ({ date, weightKg });

describe('movingAverage', () => {
  it('averages the trailing window', () => {
    const points = movingAverage([
      w('2026-10-01', 80),
      w('2026-10-02', 82),
      w('2026-10-03', 81),
    ]);
    expect(points[0]!.averageKg).toBe(80);
    expect(points[1]!.averageKg).toBe(81);
    expect(points[2]!.averageKg).toBe(81);
  });

  it('smooths a single spike', () => {
    const readings = Array.from({ length: 7 }, (_, i) =>
      w(`2026-10-0${i + 1}`, i === 3 ? 90 : 80),
    );
    const last = movingAverage(readings).at(-1)!;
    expect(last.weightKg).toBe(80);
    // One 10 kg spike moves a 7-day average by about 1.4 kg, not 10.
    expect(last.averageKg).toBeCloseTo(81.4, 1);
  });

  it('only looks back within the window', () => {
    const points = movingAverage([
      w('2026-10-01', 90),
      w('2026-10-20', 80),
    ]);
    // The October reading is far outside the 7-day window of the later one.
    expect(points[1]!.averageKg).toBe(80);
  });

  it('sorts unordered input', () => {
    const points = movingAverage([w('2026-10-03', 81), w('2026-10-01', 80)]);
    expect(points.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-03']);
  });

  it('handles a single reading', () => {
    expect(movingAverage([w('2026-10-01', 80)])[0]!.averageKg).toBe(80);
  });

  it('returns nothing for no readings', () => {
    expect(movingAverage([])).toEqual([]);
  });

  it('copes with a gap in logging', () => {
    const points = movingAverage([
      w('2026-10-01', 80),
      w('2026-10-05', 82),
      w('2026-10-06', 84),
    ]);
    // All three are inside the 7-day window of the last one.
    expect(points[2]!.averageKg).toBe(82);
  });

  it('respects a custom window', () => {
    const points = movingAverage(
      [w('2026-10-01', 80), w('2026-10-02', 90)],
      1,
    );
    expect(points[1]!.averageKg).toBe(90);
  });
});

describe('weightTrend', () => {
  it('reports a loss across two weeks', () => {
    const readings = [
      ...Array.from({ length: 7 }, (_, i) => w(isoDay(1 + i), 85)),
      ...Array.from({ length: 7 }, (_, i) => w(isoDay(8 + i), 84)),
    ];
    const trend = weightTrend(readings);
    expect(trend.direction).toBe('down');
    expect(trend.weeklyChangeKg).toBeLessThan(0);
  });

  it('reports a gain', () => {
    const readings = [
      ...Array.from({ length: 7 }, (_, i) => w(isoDay(1 + i), 70)),
      ...Array.from({ length: 7 }, (_, i) => w(isoDay(8 + i), 71.5)),
    ];
    expect(weightTrend(readings).direction).toBe('up');
  });

  it('calls a steady weight flat', () => {
    const readings = Array.from({ length: 14 }, (_, i) => w(isoDay(1 + i), 80));
    const trend = weightTrend(readings);
    expect(trend.direction).toBe('flat');
    expect(trend.weeklyChangeKg).toBe(0);
  });

  it('is unknown with no history', () => {
    const trend = weightTrend([]);
    expect(trend.direction).toBe('unknown');
    expect(trend.currentKg).toBeNull();
    expect(trend.readings).toBe(0);
  });

  it('is unknown with too little history to compare', () => {
    const trend = weightTrend([w('2026-10-01', 80), w('2026-10-02', 80)]);
    expect(trend.currentKg).not.toBeNull();
    expect(trend.direction).toBe('unknown');
  });

  it('counts the readings it used', () => {
    const readings = Array.from({ length: 5 }, (_, i) => w(isoDay(1 + i), 80));
    expect(weightTrend(readings).readings).toBe(5);
  });
});

describe('measurementDeltas', () => {
  it('reports the change for each measurement present in both', () => {
    const deltas = measurementDeltas(
      { waistCm: 90, chestCm: 100 },
      { waistCm: 86, chestCm: 102 },
    );
    expect(deltas).toHaveLength(2);
    expect(deltas.find((d) => d.key === 'waistCm')!.changeCm).toBe(-4);
    expect(deltas.find((d) => d.key === 'chestCm')!.changeCm).toBe(2);
  });

  it('skips measurements missing from either end', () => {
    const deltas = measurementDeltas({ waistCm: 90 }, { waistCm: 88, armCm: 35 });
    expect(deltas.map((d) => d.key)).toEqual(['waistCm']);
  });

  it('returns nothing when there is no overlap', () => {
    expect(measurementDeltas({}, { waistCm: 88 })).toEqual([]);
  });

  it('keeps a readable label for each', () => {
    const deltas = measurementDeltas({ thighCm: 60 }, { thighCm: 58 });
    expect(deltas[0]!.label).toBe('Thigh');
  });
});

function isoDay(day: number): string {
  return `2026-10-${String(day).padStart(2, '0')}`;
}
