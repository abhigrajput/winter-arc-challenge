import type { Equipment, MuscleGroup } from '@/lib/exercises';

/**
 * Training splits (§8.1): 3 days = full body, 4 = upper/lower,
 * 5 = upper/lower/PPL hybrid, 6 = push/pull/legs twice.
 *
 * A split is a rotation of named days. Which day you get is driven by how many
 * sessions you have already logged, so skipping a day never skips a muscle
 * group — you simply pick up where the rotation left off.
 */

export type SplitDayName =
  | 'Full body'
  | 'Upper'
  | 'Lower'
  | 'Push'
  | 'Pull'
  | 'Legs';

export interface SplitDay {
  name: SplitDayName;
  /** Muscle groups trained, in the order they should be worked. */
  focus: MuscleGroup[];
}

const FULL_BODY: SplitDay = {
  name: 'Full body',
  focus: ['legs', 'chest', 'back', 'shoulders', 'core'],
};
const UPPER: SplitDay = { name: 'Upper', focus: ['chest', 'back', 'shoulders', 'arms'] };
const LOWER: SplitDay = { name: 'Lower', focus: ['legs', 'core'] };
const PUSH: SplitDay = { name: 'Push', focus: ['chest', 'shoulders', 'arms'] };
const PULL: SplitDay = { name: 'Pull', focus: ['back', 'arms'] };
const LEGS: SplitDay = { name: 'Legs', focus: ['legs', 'core'] };

/** The rotation for a given weekly frequency. §8.1. */
export function splitForDays(daysPerWeek: number): SplitDay[] {
  const days = Math.min(6, Math.max(3, Math.round(daysPerWeek)));

  switch (days) {
    case 3:
      return [FULL_BODY, FULL_BODY, FULL_BODY];
    case 4:
      return [UPPER, LOWER, UPPER, LOWER];
    case 5:
      // Upper/lower to open the week, then PPL to finish it.
      return [UPPER, LOWER, PUSH, PULL, LEGS];
    default:
      return [PUSH, PULL, LEGS, PUSH, PULL, LEGS];
  }
}

/** Which day of the rotation comes next, given how many are already done. */
export function nextSplitDay(daysPerWeek: number, sessionsLogged: number): SplitDay {
  const rotation = splitForDays(daysPerWeek);
  const index = ((sessionsLogged % rotation.length) + rotation.length) % rotation.length;
  return rotation[index]!;
}

/** Equipment a user can actually reach, from their profile. */
export function availableEquipment(
  trainingMode: string | null,
  ownedEquipment: readonly string[] | null,
): Set<Equipment> {
  // Bodyweight is always on the table.
  const available = new Set<Equipment>(['bodyweight']);

  if (trainingMode === 'gym' || trainingMode === 'hybrid') {
    for (const item of ['barbell', 'dumbbells', 'machines', 'bench', 'pull_up_bar', 'bands'] as const) {
      available.add(item);
    }
    if (trainingMode === 'gym') return available;
  }

  for (const item of ownedEquipment ?? []) {
    if (isEquipment(item)) available.add(item);
  }

  return available;
}

function isEquipment(value: string): value is Equipment {
  return (
    value === 'bodyweight' ||
    value === 'pull_up_bar' ||
    value === 'dumbbells' ||
    value === 'barbell' ||
    value === 'bench' ||
    value === 'machines' ||
    value === 'bands'
  );
}

/** How many working sets fit a session of the given length. */
export function setsForSession(sessionMinutes: number): number {
  if (sessionMinutes <= 30) return 9;
  if (sessionMinutes <= 45) return 14;
  if (sessionMinutes <= 60) return 18;
  return 24;
}

/** Rep range by goal and exercise type. Bodyweight work runs higher. */
export function repRange(isBodyweight: boolean, level: string | null): { low: number; top: number } {
  if (isBodyweight) {
    return level === 'advanced' ? { low: 6, top: 12 } : { low: 8, top: 15 };
  }
  return { low: 6, top: 10 };
}
