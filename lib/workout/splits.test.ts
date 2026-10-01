import { describe, expect, it } from 'vitest';
import {
  availableEquipment,
  nextSplitDay,
  repRange,
  setsForSession,
  splitForDays,
} from './splits';

describe('splitForDays', () => {
  it('matches §8.1 for each frequency', () => {
    expect(splitForDays(3).map((d) => d.name)).toEqual(['Full body', 'Full body', 'Full body']);
    expect(splitForDays(4).map((d) => d.name)).toEqual(['Upper', 'Lower', 'Upper', 'Lower']);
    expect(splitForDays(5).map((d) => d.name)).toEqual(['Upper', 'Lower', 'Push', 'Pull', 'Legs']);
    expect(splitForDays(6).map((d) => d.name)).toEqual([
      'Push',
      'Pull',
      'Legs',
      'Push',
      'Pull',
      'Legs',
    ]);
  });

  it('produces one day per training day', () => {
    for (const days of [3, 4, 5, 6]) {
      expect(splitForDays(days)).toHaveLength(days);
    }
  });

  it('clamps out-of-range frequencies', () => {
    expect(splitForDays(1)).toHaveLength(3);
    expect(splitForDays(9)).toHaveLength(6);
  });

  it('covers legs in every rotation', () => {
    for (const days of [3, 4, 5, 6]) {
      const trains = splitForDays(days).flatMap((d) => d.focus);
      expect(trains, `${days} days`).toContain('legs');
    }
  });

  it('covers push and pull in every rotation', () => {
    for (const days of [3, 4, 5, 6]) {
      const trains = new Set(splitForDays(days).flatMap((d) => d.focus));
      expect(trains.has('chest'), `${days} days`).toBe(true);
      expect(trains.has('back'), `${days} days`).toBe(true);
    }
  });
});

describe('nextSplitDay', () => {
  it('walks the rotation in order', () => {
    expect(nextSplitDay(4, 0).name).toBe('Upper');
    expect(nextSplitDay(4, 1).name).toBe('Lower');
    expect(nextSplitDay(4, 2).name).toBe('Upper');
  });

  it('wraps around at the end of the rotation', () => {
    expect(nextSplitDay(4, 4).name).toBe('Upper');
    expect(nextSplitDay(6, 7).name).toBe('Pull');
  });

  it('handles a negative count without throwing', () => {
    expect(nextSplitDay(4, -1).name).toBeTruthy();
  });
});

describe('availableEquipment', () => {
  it('gives a gym user everything', () => {
    const gym = availableEquipment('gym', []);
    expect(gym.has('barbell')).toBe(true);
    expect(gym.has('machines')).toBe(true);
    expect(gym.has('bodyweight')).toBe(true);
  });

  it('limits a home user to what they own, plus bodyweight', () => {
    const home = availableEquipment('home', ['pull_up_bar', 'bands']);
    expect(home.has('bodyweight')).toBe(true);
    expect(home.has('pull_up_bar')).toBe(true);
    expect(home.has('bands')).toBe(true);
    expect(home.has('barbell')).toBe(false);
    expect(home.has('machines')).toBe(false);
  });

  it('always allows bodyweight, even with nothing owned', () => {
    expect(availableEquipment('home', []).has('bodyweight')).toBe(true);
    expect(availableEquipment(null, null).has('bodyweight')).toBe(true);
  });

  it('gives a hybrid user the gym plus anything they own at home', () => {
    const hybrid = availableEquipment('hybrid', ['bands']);
    expect(hybrid.has('barbell')).toBe(true);
    expect(hybrid.has('bands')).toBe(true);
  });

  it('ignores unknown equipment strings', () => {
    const home = availableEquipment('home', ['kettlebell_of_doom']);
    expect(home.has('bodyweight')).toBe(true);
    expect(home.size).toBe(1);
  });
});

describe('setsForSession', () => {
  it('scales with session length', () => {
    expect(setsForSession(30)).toBeLessThan(setsForSession(45));
    expect(setsForSession(45)).toBeLessThan(setsForSession(60));
    expect(setsForSession(60)).toBeLessThan(setsForSession(90));
  });

  it('always leaves room for real work', () => {
    expect(setsForSession(30)).toBeGreaterThanOrEqual(6);
  });
});

describe('repRange', () => {
  it('runs higher for bodyweight work', () => {
    expect(repRange(true, 'beginner').top).toBeGreaterThan(repRange(false, 'beginner').top);
  });

  it('always has a low below the top', () => {
    for (const bw of [true, false]) {
      for (const level of ['beginner', 'intermediate', 'advanced']) {
        const range = repRange(bw, level);
        expect(range.low).toBeLessThan(range.top);
      }
    }
  });
});
