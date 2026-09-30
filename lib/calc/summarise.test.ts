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

  it('counts every row when no current date is given', () => {
    const days = summariseDays([
      { log_date: '2026-09-30', completed: true, active: false },
      { log_date: '2026-09-30', completed: true, active: true },
    ]);
    expect(days[0]).toEqual({ date: '2026-09-30', completed: 2, active: 2 });
  });

  it('drops rows for switched-off tasks from today onward', () => {
    // The live database has no DELETE policy on daily_logs, so a task turned
    // off today leaves an orphan row. It must not make the day unfinishable.
    const days = summariseDays(
      [
        { log_date: '2026-09-30', completed: false, active: false },
        { log_date: '2026-09-30', completed: true, active: true },
        { log_date: '2026-10-01', completed: false, active: false },
      ],
      '2026-09-30',
    );
    expect(days).toEqual([{ date: '2026-09-30', completed: 1, active: 1 }]);
  });

  it('keeps switched-off tasks in past days, so earned streaks stand', () => {
    const days = summariseDays(
      [
        { log_date: '2026-09-29', completed: true, active: false },
        { log_date: '2026-09-29', completed: true, active: true },
      ],
      '2026-09-30',
    );
    expect(days[0]).toEqual({ date: '2026-09-29', completed: 2, active: 2 });
  });
});
