import { describe, expect, it } from 'vitest';
import {
  defaultReminderSettings,
  fromMinutes,
  normalizeTime,
  parseReminderSettings,
  toMinutes,
} from './settings';
import { reminderPayload } from './messages';

const profile = { wake_time: '05:00:00', sleep_target_h: 8, modules: [] as string[] };

describe('defaultReminderSettings', () => {
  it('derives wake and wind-down from the profile', () => {
    const s = defaultReminderSettings({ wake_time: '06:30:00', sleep_target_h: 7.5, modules: [] });
    expect(s.wake).toEqual({ enabled: true, time: '06:30' });
    // Bed 23:00, wind down 22:30.
    expect(s.wind_down).toEqual({ enabled: true, time: '22:30' });
  });

  it('keeps water opt-in and skincare tied to the skin module', () => {
    expect(defaultReminderSettings(profile).water.enabled).toBe(false);
    expect(defaultReminderSettings(profile).skincare_pm.enabled).toBe(false);
    expect(defaultReminderSettings({ ...profile, modules: ['face_skin'] }).skincare_pm.enabled).toBe(true);
  });

  it('copes with a missing profile', () => {
    const s = defaultReminderSettings({ wake_time: null, sleep_target_h: null, modules: null });
    expect(s.wake.time).toBe('05:00');
    expect(s.wind_down.time).toBe('20:30');
  });
});

describe('parseReminderSettings', () => {
  it('returns defaults for nothing stored', () => {
    expect(parseReminderSettings(null, profile)).toEqual(defaultReminderSettings(profile));
  });

  it('merges a partial row over the defaults', () => {
    const s = parseReminderSettings({ water: { enabled: true }, workout: { time: '07:15' } }, profile);
    expect(s.water.enabled).toBe(true);
    expect(s.workout).toEqual({ enabled: true, time: '07:15' });
    expect(s.wake.time).toBe('05:00');
  });

  it('drops malformed kinds instead of failing everything', () => {
    const s = parseReminderSettings({ wake: { enabled: 'yes', time: '25:00' }, water: { enabled: true } }, profile);
    expect(s.wake).toEqual({ enabled: true, time: '05:00' });
    expect(s.water.enabled).toBe(true);
  });
});

describe('time helpers', () => {
  it('normalizes database times', () => {
    expect(normalizeTime('05:00:00')).toBe('05:00');
    expect(normalizeTime('5:07')).toBe('05:07');
    expect(normalizeTime('24:00')).toBeNull();
    expect(normalizeTime(null)).toBeNull();
  });

  it('wraps minutes around midnight', () => {
    expect(fromMinutes(-30)).toBe('23:30');
    expect(fromMinutes(1440 + 75)).toBe('01:15');
    expect(toMinutes('20:30')).toBe(1230);
  });
});

describe('reminderPayload', () => {
  it('streak-at-risk states the numbers, without shame', () => {
    const p = reminderPayload(
      { kind: 'streak_risk', key: 'streak_risk', localDate: '2026-10-04' },
      { completed: 3, active: 10, doneSlugs: new Set() },
      12,
    );
    expect(p).toMatchObject({ title: 'Streak at risk', body: '3/10 done. 5 more keeps the streak.', url: '/today' });
  });

  it('wake mentions the day number', () => {
    const p = reminderPayload({ kind: 'wake', key: 'wake', localDate: '2026-10-04' }, null, 12);
    expect(p.body).toBe('Day 12 of 90. Log it.');
  });
});
