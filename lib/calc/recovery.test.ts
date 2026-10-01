import { describe, expect, it } from 'vitest';
import {
  SLEEP_TARGET_MAX_HOURS,
  SLEEP_TARGET_MIN_HOURS,
  recoveryScore,
  sleepDuration,
  sleepHoursScore,
} from './recovery';

describe('sleepHoursScore', () => {
  it('scores the 7-9 hour target as perfect', () => {
    expect(sleepHoursScore(SLEEP_TARGET_MIN_HOURS)).toBe(1);
    expect(sleepHoursScore(8)).toBe(1);
    expect(sleepHoursScore(SLEEP_TARGET_MAX_HOURS)).toBe(1);
  });

  it('falls off below the target', () => {
    expect(sleepHoursScore(6)).toBeLessThan(1);
    expect(sleepHoursScore(5)).toBeLessThan(sleepHoursScore(6));
    expect(sleepHoursScore(4)).toBe(0);
    expect(sleepHoursScore(2)).toBe(0);
  });

  it('penalises oversleeping, but gently', () => {
    expect(sleepHoursScore(10)).toBeLessThan(1);
    expect(sleepHoursScore(10)).toBeGreaterThan(sleepHoursScore(5));
  });

  it('never leaves 0-1', () => {
    for (const hours of [0, 1, 4, 7, 9, 12, 16, 24]) {
      const score = sleepHoursScore(hours);
      expect(score, `${hours}h`).toBeGreaterThanOrEqual(0);
      expect(score, `${hours}h`).toBeLessThanOrEqual(1);
    }
  });
});

describe('recoveryScore', () => {
  const full = {
    sleepHours: 8,
    sleepQuality: 5,
    soreness: 1,
    previousSessionRpe: 3,
  };

  it('scores a well-rested day near the top', () => {
    const result = recoveryScore(full);
    expect(result.score).toBeGreaterThan(85);
    expect(result.band).toBe('good');
  });

  it('scores a wrecked day low and says to go lighter', () => {
    const result = recoveryScore({
      sleepHours: 4.5,
      sleepQuality: 1,
      soreness: 5,
      previousSessionRpe: 10,
    });
    expect(result.score).toBeLessThan(30);
    expect(result.band).toBe('low');
    expect(result.advice).toMatch(/lighter/i);
  });

  it('bands moderate in between', () => {
    const result = recoveryScore({
      sleepHours: 6.5,
      sleepQuality: 3,
      soreness: 3,
      previousSessionRpe: 6,
    });
    expect(result.band).toBe('moderate');
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.score).toBeLessThan(75);
  });

  it('is unknown with nothing logged', () => {
    const result = recoveryScore({
      sleepHours: null,
      sleepQuality: null,
      soreness: null,
      previousSessionRpe: null,
    });
    expect(result.score).toBeNull();
    expect(result.band).toBe('unknown');
    expect(result.inputsUsed).toEqual([]);
  });

  it('renormalises when only sleep is logged', () => {
    const result = recoveryScore({
      sleepHours: 8,
      sleepQuality: null,
      soreness: null,
      previousSessionRpe: null,
    });
    // Perfect sleep alone should read as good, not be dragged down by absence.
    expect(result.score).toBe(100);
    expect(result.inputsUsed).toEqual(['sleep hours']);
  });

  it('does not punish a rest day for having no session', () => {
    const withSession = recoveryScore({ ...full, previousSessionRpe: 9 });
    const restDay = recoveryScore({ ...full, previousSessionRpe: null });
    expect(restDay.score!).toBeGreaterThan(withSession.score!);
  });

  it('drops when yesterday was hard', () => {
    const easy = recoveryScore({ ...full, previousSessionRpe: 2 });
    const hard = recoveryScore({ ...full, previousSessionRpe: 10 });
    expect(hard.score!).toBeLessThan(easy.score!);
  });

  it('drops with soreness', () => {
    const fresh = recoveryScore({ ...full, soreness: 1 });
    const sore = recoveryScore({ ...full, soreness: 5 });
    expect(sore.score!).toBeLessThan(fresh.score!);
  });

  it('stays within 0-100', () => {
    const extremes = [
      { sleepHours: 0.5, sleepQuality: 1, soreness: 5, previousSessionRpe: 10 },
      { sleepHours: 24, sleepQuality: 5, soreness: 1, previousSessionRpe: 1 },
    ];
    for (const input of extremes) {
      const score = recoveryScore(input).score!;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('reports which inputs it used', () => {
    const result = recoveryScore({ ...full, soreness: null });
    expect(result.inputsUsed).toContain('sleep hours');
    expect(result.inputsUsed).not.toContain('soreness');
  });
});

describe('sleepDuration', () => {
  it('handles a night that crosses midnight', () => {
    expect(sleepDuration('23:00', '07:00')).toBe(8);
    expect(sleepDuration('22:30', '06:00')).toBe(7.5);
  });

  it('handles a nap inside one day', () => {
    expect(sleepDuration('01:00', '09:00')).toBe(8);
  });

  it('rejects implausible lengths', () => {
    expect(sleepDuration('09:00', '09:00')).toBeNull();
    expect(sleepDuration('10:00', '04:00')).toBeNull();
  });

  it('rejects malformed times', () => {
    expect(sleepDuration('bedtime', '07:00')).toBeNull();
    expect(sleepDuration('25:00', '07:00')).toBeNull();
    expect(sleepDuration('23:99', '07:00')).toBeNull();
    expect(sleepDuration('', '')).toBeNull();
  });

  it('rounds to one decimal', () => {
    expect(sleepDuration('23:10', '06:40')).toBe(7.5);
  });
});
