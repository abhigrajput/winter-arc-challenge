import { describe, expect, it } from 'vitest';
import { EQUIPMENT, EXERCISES, MUSCLE_GROUPS, toDatabaseRows } from './exercises';

describe('exercise library', () => {
  it('seeds a full library', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(80);
  });

  it('has unique ids and slugs', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(new Set(EXERCISES.map((e) => e.slug)).size).toBe(EXERCISES.length);
  });

  it('uses only known muscle groups and equipment', () => {
    for (const exercise of EXERCISES) {
      expect(MUSCLE_GROUPS).toContain(exercise.muscle_group);
      expect(EQUIPMENT).toContain(exercise.equipment);
    }
  });

  it('gives every exercise cues and common mistakes', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.cues.length, exercise.slug).toBeGreaterThan(0);
      expect(exercise.mistakes.length, exercise.slug).toBeGreaterThan(0);
    }
  });

  it('only points progressions at exercises that exist', () => {
    const slugs = new Set(EXERCISES.map((e) => e.slug));
    for (const exercise of EXERCISES) {
      if (exercise.progression_of) {
        expect(slugs, exercise.slug).toContain(exercise.progression_of);
      }
    }
  });

  it('never makes an exercise progress from itself', () => {
    for (const exercise of EXERCISES) {
      expect(exercise.progression_of).not.toBe(exercise.slug);
    }
  });

  it('has no cycles in any progression chain', () => {
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    for (const exercise of EXERCISES) {
      const seen = new Set<string>([exercise.slug]);
      let cursor = exercise.progression_of;
      while (cursor) {
        expect(seen.has(cursor), `cycle at ${exercise.slug}`).toBe(false);
        seen.add(cursor);
        cursor = bySlug.get(cursor)?.progression_of;
      }
    }
  });

  it('carries the §8.1 push-up chain', () => {
    const chain = ['push_up', 'diamond_push_up', 'archer_push_up', 'pseudo_planche_push_up'];
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    for (let i = 1; i < chain.length; i += 1) {
      expect(bySlug.get(chain[i]!)?.progression_of).toBe(chain[i - 1]);
    }
  });

  it('carries the §8.1 pull-up chain', () => {
    const chain = [
      'dead_hang',
      'scap_pull_up',
      'negative_pull_up',
      'band_assisted_pull_up',
      'pull_up',
      'weighted_pull_up',
    ];
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    for (let i = 1; i < chain.length; i += 1) {
      expect(bySlug.get(chain[i]!)?.progression_of).toBe(chain[i - 1]);
    }
  });

  it('carries the §8.1 squat chain', () => {
    const chain = [
      'bodyweight_squat',
      'split_squat',
      'bulgarian_split_squat',
      'assisted_pistol_squat',
      'pistol_squat',
    ];
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    for (let i = 1; i < chain.length; i += 1) {
      expect(bySlug.get(chain[i]!)?.progression_of).toBe(chain[i - 1]);
    }
  });

  it('carries the §8.2 ab chains', () => {
    const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));
    expect(bySlug.get('hanging_knee_raise')?.progression_of).toBe('hollow_hold');
    expect(bySlug.get('hanging_leg_raise')?.progression_of).toBe('hanging_knee_raise');
    expect(bySlug.get('toes_to_bar')?.progression_of).toBe('hanging_leg_raise');
    expect(bySlug.get('rkc_plank')?.progression_of).toBe('plank');
    expect(bySlug.get('ab_wheel_rollout')?.progression_of).toBe('rkc_plank');
  });

  it('includes Surya Namaskar as a mobility block', () => {
    const surya = EXERCISES.find((e) => e.slug === 'surya_namaskar');
    expect(surya?.muscle_group).toBe('mobility');
  });

  it('offers a home-equipment option for every major muscle group', () => {
    const homeEquipment = new Set(['bodyweight', 'pull_up_bar', 'bands', 'dumbbells']);
    for (const group of ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const) {
      const available = EXERCISES.filter(
        (e) => e.muscle_group === group && homeEquipment.has(e.equipment),
      );
      expect(available.length, group).toBeGreaterThan(0);
    }
  });

  it('never recommends jaw devices or mewing (§8.4)', () => {
    const text = JSON.stringify(EXERCISES).toLowerCase();
    expect(text).not.toContain('mewing');
    expect(text).not.toContain('jaw exerciser');
    expect(text).not.toContain('jawzrsize');
  });
});

describe('toDatabaseRows', () => {
  it('resolves progression slugs to ids', () => {
    const rows = toDatabaseRows();
    const pushUp = rows.find((r) => r.slug === 'push_up');
    const kneePushUp = rows.find((r) => r.slug === 'knee_push_up');
    expect(pushUp?.progression_of).toBe(kneePushUp?.id);
  });

  it('leaves chain starts with a null parent', () => {
    const rows = toDatabaseRows();
    expect(rows.find((r) => r.slug === 'dead_hang')?.progression_of).toBeNull();
  });

  it('emits one row per exercise', () => {
    expect(toDatabaseRows()).toHaveLength(EXERCISES.length);
  });
});
