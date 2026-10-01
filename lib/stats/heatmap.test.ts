import { describe, expect, it } from 'vitest';
import { heatmapWeeks } from './heatmap';

const days = [{ date: '2026-09-10', completed: 8, active: 10 }];

describe('heatmapWeeks', () => {
  it('builds a 13 by 7 grid', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    expect(weeks).toHaveLength(13);
    for (const week of weeks) expect(week).toHaveLength(7);
  });

  it('numbers days from 1', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    expect(weeks[0]![0]!.dayNumber).toBe(1);
    expect(weeks[0]![0]!.date).toBe('2026-09-10');
    expect(weeks[0]![6]!.dayNumber).toBe(7);
  });

  it('marks day 91 as outside the arc', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    const last = weeks[12]![6]!;
    expect(last.dayNumber).toBe(91);
    expect(last.inRange).toBe(false);
  });

  it('keeps day 90 inside the arc', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    const day90 = weeks[12]![5]!;
    expect(day90.dayNumber).toBe(90);
    expect(day90.inRange).toBe(true);
  });

  it('marks exactly one cell out of range', () => {
    const outOfRange = heatmapWeeks(days, '2026-09-10')
      .flat()
      .filter((cell) => !cell.inRange);
    expect(outOfRange).toHaveLength(1);
  });

  it('carries real completion through', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    expect(weeks[0]![0]!.completed).toBe(8);
    expect(weeks[0]![0]!.active).toBe(10);
  });

  it('fills unlogged days as empty, not missing', () => {
    const weeks = heatmapWeeks(days, '2026-09-10');
    expect(weeks[0]![1]).toEqual({
      date: '2026-09-11',
      completed: 0,
      active: 0,
      dayNumber: 2,
      inRange: true,
    });
  });

  it('returns nothing without a start date', () => {
    expect(heatmapWeeks(days, null)).toEqual([]);
  });
});
