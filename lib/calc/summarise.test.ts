import { describe, expect, it } from 'vitest';
import { summariseDays } from './streak';

describe('summariseDays', () => {
  it('rolls logs up per day', () => {
    const days = summariseDays([
      { log_date: '2026-09-30', completed: true },
      { log_date: '2026-09-30', completed: false },
      { log_date: '2026-09-30', completed: true },
      { log_date: '2026-09-29', completed: true },
    ]);

    expect(days).toEqual([
      { date: '2026-09-29', completed: 1, active: 1 },
      { date: '2026-09-30', completed: 2, active: 3 },
    ]);
  });

  it('sorts oldest first', () => {
    const days = summariseDays([
      { log_date: '2026-10-02', completed: true },
      { log_date: '2026-09-28', completed: true },
      { log_date: '2026-09-30', completed: true },
    ]);
    expect(days.map((d) => d.date)).toEqual(['2026-09-28', '2026-09-30', '2026-10-02']);
  });

  it('counts a null completed flag as not done', () => {
    const days = summariseDays([{ log_date: '2026-09-30', completed: null }]);
    expect(days[0]).toEqual({ date: '2026-09-30', completed: 0, active: 1 });
  });

  it('skips rows with no date', () => {
    const days = summariseDays([
      { log_date: null, completed: true },
      { log_date: '2026-09-30', completed: true },
    ]);
    expect(days).toHaveLength(1);
  });

  it('returns nothing for an empty history', () => {
    expect(summariseDays([])).toEqual([]);
  });
});
