import { describe, expect, it } from 'vitest';
import {
  CHALLENGE_DAYS,
  challengeDay,
  challengeDayOn,
  isWritableLogDate,
  localDate,
  phaseForDay,
  shiftDate,
} from './day';

describe('localDate', () => {
  it('uses the user timezone, not the server clock', () => {
    // 20:30 UTC is already the next day in Asia/Kolkata (UTC+5:30).
    const instant = new Date('2026-09-30T20:30:00Z');
    expect(localDate('Asia/Kolkata', instant)).toBe('2026-10-01');
    expect(localDate('UTC', instant)).toBe('2026-09-30');
  });

  it('handles a timezone behind UTC', () => {
    const instant = new Date('2026-09-30T02:00:00Z');
    expect(localDate('America/New_York', instant)).toBe('2026-09-29');
    expect(localDate('UTC', instant)).toBe('2026-09-30');
  });

  it('falls back to Asia/Kolkata when the timezone is blank', () => {
    const instant = new Date('2026-09-30T20:30:00Z');
    expect(localDate('', instant)).toBe('2026-10-01');
  });
});

describe('shiftDate', () => {
  it('moves whole days and crosses month boundaries', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isWritableLogDate', () => {
  // 12:00 IST on 2026-09-30.
  const now = new Date('2026-09-30T06:30:00Z');
  const tz = 'Asia/Kolkata';

  it('accepts yesterday, today and tomorrow', () => {
    expect(isWritableLogDate('2026-09-29', tz, now)).toBe(true);
    expect(isWritableLogDate('2026-09-30', tz, now)).toBe(true);
    expect(isWritableLogDate('2026-10-01', tz, now)).toBe(true);
  });

  it('refuses backfilling and racing ahead', () => {
    expect(isWritableLogDate('2026-09-28', tz, now)).toBe(false);
    expect(isWritableLogDate('2026-10-02', tz, now)).toBe(false);
    expect(isWritableLogDate('2026-01-01', tz, now)).toBe(false);
  });

  it('uses the user timezone for the window', () => {
    // 20:30 UTC: still the 30th in UTC, already the 1st in IST.
    const evening = new Date('2026-09-30T20:30:00Z');
    expect(isWritableLogDate('2026-10-02', 'Asia/Kolkata', evening)).toBe(true);
    expect(isWritableLogDate('2026-10-02', 'UTC', evening)).toBe(false);
  });
});

describe('challengeDay', () => {
  const tz = 'Asia/Kolkata';
  const now = new Date('2026-09-30T06:30:00Z');

  it('counts the start date as day 1', () => {
    expect(challengeDay('2026-09-30', tz, now)).toBe(1);
  });

  it('counts elapsed days', () => {
    expect(challengeDay('2026-09-01', tz, now)).toBe(30);
  });

  it('returns 0 before the start date', () => {
    expect(challengeDay('2026-10-05', tz, now)).toBe(0);
  });

  it('returns 0 when there is no start date', () => {
    expect(challengeDay(null, tz, now)).toBe(0);
  });

  it('caps at 90', () => {
    expect(challengeDay('2025-01-01', tz, now)).toBe(CHALLENGE_DAYS);
  });
});

describe('phaseForDay', () => {
  it('maps the four phases from §7', () => {
    expect(phaseForDay(1).name).toBe('Foundation');
    expect(phaseForDay(28).name).toBe('Foundation');
    expect(phaseForDay(29).name).toBe('Build');
    expect(phaseForDay(56).name).toBe('Build');
    expect(phaseForDay(57).name).toBe('Peak');
    expect(phaseForDay(84).name).toBe('Peak');
    expect(phaseForDay(85).name).toBe('Test');
    expect(phaseForDay(90).name).toBe('Test');
  });

  it('numbers the weeks', () => {
    expect(phaseForDay(1).week).toBe(1);
    expect(phaseForDay(7).week).toBe(1);
    expect(phaseForDay(8).week).toBe(2);
    expect(phaseForDay(90).week).toBe(13);
  });

  it('flags weeks 4 and 8 as deloads, and nothing else', () => {
    expect(phaseForDay(22).deload).toBe(true); // week 4
    expect(phaseForDay(28).deload).toBe(true);
    expect(phaseForDay(50).deload).toBe(true); // week 8
    expect(phaseForDay(21).deload).toBe(false);
    expect(phaseForDay(29).deload).toBe(false);
    expect(phaseForDay(60).deload).toBe(false);
  });

  it('treats day 0 as week 1', () => {
    expect(phaseForDay(0).week).toBe(1);
    expect(phaseForDay(0).name).toBe('Foundation');
  });
});

describe('challengeDayOn', () => {
  it('counts from a known local date', () => {
    expect(challengeDayOn('2026-10-01', '2026-10-01')).toBe(1);
    expect(challengeDayOn('2026-10-01', '2026-10-03')).toBe(3);
  });

  it('is 0 before the start and without a start', () => {
    expect(challengeDayOn('2026-10-05', '2026-10-03')).toBe(0);
    expect(challengeDayOn(null, '2026-10-03')).toBe(0);
  });

  it('caps at day 90', () => {
    expect(challengeDayOn('2026-01-01', '2026-12-31')).toBe(90);
  });
});
