import { describe, expect, it } from 'vitest';
import {
  candidateReminders,
  dueReminders,
  filterByProgress,
  inWindow,
  localClock,
  needsProgress,
  type DayContext,
  type DueReminder,
} from './due';
import { defaultReminderSettings, type ReminderSettings } from './settings';

const profile = { wake_time: '05:00:00', sleep_target_h: 8, modules: ['face_skin'] };
const base = defaultReminderSettings(profile);

/** Everything on, at known times. */
const all: ReminderSettings = {
  wake: { enabled: true, time: '05:00' },
  workout: { enabled: true, time: '18:00' },
  water: { enabled: true },
  skincare_pm: { enabled: true, time: '21:30' },
  wind_down: { enabled: true, time: '22:00' },
  streak_risk: { enabled: true },
};

const nothingDone: DayContext = { completed: 0, active: 10, doneSlugs: new Set() };

function kindsAt(iso: string, timezone: string, settings: ReminderSettings = all): string[] {
  return candidateReminders(settings, localClock(new Date(iso), timezone)).map((r) => r.key);
}

/** Every 15-minute cron run from `startIso` for `hours` hours. */
function sweep(startIso: string, hours: number, timezone: string, settings: ReminderSettings = all) {
  const runs: DueReminder[] = [];
  const start = new Date(startIso).getTime();
  for (let i = 0; i < hours * 4; i += 1) {
    // Cron fires a few seconds late; make sure that never moves the window.
    const now = new Date(start + i * 15 * 60_000 + 7_000);
    runs.push(...candidateReminders(settings, localClock(now, timezone)));
  }
  return runs;
}

describe('localClock', () => {
  it('IST: 23:30Z is 05:00 the next local day', () => {
    const clock = localClock(new Date('2026-10-03T23:30:00Z'), 'Asia/Kolkata');
    expect(clock).toMatchObject({ date: '2026-10-04', minutes: 300, windowStart: 300 });
  });

  it('floors to the 15-minute window', () => {
    expect(localClock(new Date('2026-10-03T23:44:59Z'), 'Asia/Kolkata').windowStart).toBe(300);
    expect(localClock(new Date('2026-10-03T23:45:00Z'), 'Asia/Kolkata').windowStart).toBe(315);
  });

  it('falls back to Asia/Kolkata for a missing or invalid timezone', () => {
    const now = new Date('2026-10-03T23:30:00Z');
    expect(localClock(now, null)).toMatchObject({ timezone: 'Asia/Kolkata', minutes: 300 });
    expect(localClock(now, 'Mars/Olympus_Mons')).toMatchObject({ timezone: 'Asia/Kolkata', minutes: 300 });
  });
});

describe('inWindow', () => {
  const clock = localClock(new Date('2026-10-03T23:37:00Z'), 'Asia/Kolkata'); // 05:07 IST
  it('includes the window start and anything before +15', () => {
    expect(inWindow('05:00', clock)).toBe(true);
    expect(inWindow('05:14', clock)).toBe(true);
  });
  it('excludes the next window and the previous one', () => {
    expect(inWindow('05:15', clock)).toBe(false);
    expect(inWindow('04:59', clock)).toBe(false);
  });
});

describe('due times across timezones', () => {
  it('IST (UTC+5:30): wake 05:00 local is 23:30Z the day before', () => {
    expect(kindsAt('2026-10-03T23:30:00Z', 'Asia/Kolkata')).toEqual(['wake']);
    expect(kindsAt('2026-10-03T23:40:00Z', 'Asia/Kolkata')).toEqual(['wake']);
    expect(kindsAt('2026-10-03T23:45:00Z', 'Asia/Kolkata')).toEqual([]);
  });

  it('AEST (Brisbane, UTC+10, no DST): wake 05:00 local is 19:00Z', () => {
    expect(kindsAt('2026-10-03T19:00:00Z', 'Australia/Brisbane')).toEqual(['wake']);
    expect(kindsAt('2026-10-03T23:30:00Z', 'Australia/Brisbane')).toEqual([]);
  });

  it('UTC: local time equals UTC', () => {
    expect(kindsAt('2026-10-04T05:00:00Z', 'UTC')).toEqual(['wake']);
    expect(kindsAt('2026-10-04T18:05:00Z', 'UTC')).toEqual(['workout', 'water_18']);
    expect(kindsAt('2026-10-04T20:10:00Z', 'UTC')).toEqual(['water_20', 'streak_risk']);
  });

  it('the same instant is a different local day per user', () => {
    const now = new Date('2026-10-03T20:00:00Z');
    expect(localClock(now, 'UTC').date).toBe('2026-10-03');
    expect(localClock(now, 'Asia/Kolkata').date).toBe('2026-10-04');
    expect(localClock(now, 'Australia/Brisbane').date).toBe('2026-10-04');
  });
});

describe('DST', () => {
  it('Sydney: wake follows 05:00 local across the October switch to AEDT', () => {
    // 3 Oct 2026: AEST (UTC+10). 5 Oct 2026: AEDT (UTC+11). DST starts 4 Oct.
    expect(kindsAt('2026-10-02T19:00:00Z', 'Australia/Sydney')).toEqual(['wake']);
    expect(kindsAt('2026-10-04T18:00:00Z', 'Australia/Sydney')).toEqual(['wake']);
    expect(kindsAt('2026-10-04T19:00:00Z', 'Australia/Sydney')).toEqual([]);
  });

  it('New York: wake follows 05:00 local across the March switch to EDT', () => {
    expect(kindsAt('2026-03-07T10:00:00Z', 'America/New_York')).toEqual(['wake']); // EST
    expect(kindsAt('2026-03-09T09:00:00Z', 'America/New_York')).toEqual(['wake']); // EDT
  });

  it('a time skipped by spring-forward (02:30 on 8 Mar) never fires that day', () => {
    const settings: ReminderSettings = { ...all, wake: { enabled: true, time: '02:30' } };
    // Local 8 Mar 2026 runs 05:00Z..04:00Z next day (23 h long).
    const runs = sweep('2026-03-08T05:00:00Z', 23, 'America/New_York', settings).filter((r) => r.kind === 'wake');
    expect(runs).toEqual([]);
  });

  it('a time repeated by fall-back (01:30 on 1 Nov) yields the same dedupe key twice', () => {
    const settings: ReminderSettings = { ...all, wake: { enabled: true, time: '01:30' } };
    const runs = sweep('2026-11-01T04:00:00Z', 25, 'America/New_York', settings).filter((r) => r.kind === 'wake');
    expect(runs).toHaveLength(2);
    // reminder_log is unique on (user, key, local_date), so only one is sent.
    expect(new Set(runs.map((r) => `${r.key}|${r.localDate}`)).size).toBe(1);
  });
});

describe('a full local day', () => {
  it.each(['Asia/Kolkata', 'Australia/Brisbane', 'UTC', 'America/New_York', 'Australia/Sydney'])(
    '%s: every reminder fires exactly once per day (water once per slot)',
    (timezone) => {
      const startLocalMidnight = sweepStart(timezone, '2026-06-15');
      const keys = sweep(startLocalMidnight, 24, timezone).map((r) => r.key).sort();
      expect(keys).toEqual(
        [
          'wake',
          'workout',
          'skincare_pm',
          'wind_down',
          'streak_risk',
          'water_08',
          'water_10',
          'water_12',
          'water_14',
          'water_16',
          'water_18',
          'water_20',
        ].sort(),
      );
    },
  );

  it('disabled kinds never fire', () => {
    const off: ReminderSettings = {
      wake: { enabled: false, time: '05:00' },
      workout: { enabled: false, time: '18:00' },
      water: { enabled: false },
      skincare_pm: { enabled: false, time: '21:30' },
      wind_down: { enabled: false, time: '22:00' },
      streak_risk: { enabled: false },
    };
    expect(sweep('2026-06-14T18:30:00Z', 24, 'Asia/Kolkata', off)).toEqual([]);
  });
});

describe('filterByProgress', () => {
  const at = (iso: string, tz = 'UTC') => candidateReminders(all, localClock(new Date(iso), tz));

  it('streak-at-risk only below 50% done', () => {
    const due = at('2026-10-04T20:00:00Z');
    const keys = (day: DayContext) => filterByProgress(due, day).map((r) => r.key);
    expect(keys({ completed: 4, active: 10, doneSlugs: new Set() })).toContain('streak_risk');
    expect(keys({ completed: 5, active: 10, doneSlugs: new Set() })).not.toContain('streak_risk');
    expect(keys({ completed: 0, active: 0, doneSlugs: new Set() })).not.toContain('streak_risk');
  });

  it('skips workout, skincare and water once their task is done', () => {
    const done: DayContext = { completed: 3, active: 10, doneSlugs: new Set(['workout', 'water']) };
    expect(filterByProgress(at('2026-10-04T18:00:00Z'), done)).toEqual([]);
    const skin = at('2026-10-04T21:30:00Z');
    expect(filterByProgress(skin, nothingDone).map((r) => r.key)).toEqual(['skincare_pm']);
    expect(filterByProgress(skin, { ...nothingDone, doneSlugs: new Set(['skincare_pm']) })).toEqual([]);
  });

  it('only loads progress when a candidate depends on it', () => {
    expect(needsProgress(at('2026-10-04T05:00:00Z'))).toBe(false); // wake
    expect(needsProgress(at('2026-10-04T22:00:00Z'))).toBe(false); // wind down
    expect(needsProgress(at('2026-10-04T18:00:00Z'))).toBe(true); // workout
  });
});

describe('dueReminders', () => {
  it('combines the window and the progress filter', () => {
    const due = dueReminders(new Date('2026-10-04T14:30:00Z'), 'Asia/Kolkata', all, nothingDone); // 20:00 IST
    expect(due.map((r) => r.key)).toEqual(['water_20', 'streak_risk']);
    expect(due[0]!.localDate).toBe('2026-10-04');
  });

  it('uses the defaults from the profile', () => {
    // Default wind-down for 05:00 wake + 8 h sleep is 20:30.
    expect(base.wind_down.time).toBe('20:30');
    const due = dueReminders(new Date('2026-10-04T15:00:00Z'), 'Asia/Kolkata', base, nothingDone); // 20:30 IST
    expect(due.map((r) => r.key)).toEqual(['wind_down']);
  });
});

/** UTC instant of local midnight on `date` in `timezone` (for sweeping a whole local day). */
function sweepStart(timezone: string, date: string): string {
  const guess = new Date(`${date}T00:00:00Z`).getTime();
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(guess - offset * 60_000);
    const clock = localClock(candidate, timezone);
    if (clock.date === date && clock.minutes === 0) return candidate.toISOString();
  }
  throw new Error(`no local midnight for ${timezone}`);
}
