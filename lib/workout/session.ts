import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ExerciseRow, ProfileRow, WorkoutSetRow } from '@/lib/supabase/types';
import { localDate } from '@/lib/calc/day';
import { bestEstimated1RM, bestReps } from '@/lib/calc/progression';
import {
  availableEquipment,
  nextSplitDay,
  repRange,
  setsForSession,
  type SplitDay,
} from '@/lib/workout/splits';

/**
 * Building and loading workout sessions (§8.1).
 *
 * The plan for a session is derived from the split rotation and the equipment
 * the user can actually reach — not stored — so changing equipment or training
 * mode takes effect on the next session without a migration.
 */

export interface PlannedExercise {
  exercise: ExerciseRow;
  sets: number;
  repLow: number;
  repTop: number;
  /** Best previous result, for the inline comparison. */
  previous: {
    bestReps: number;
    best1RM: number;
    lastWeightKg: number | null;
    lastReps: number | null;
  } | null;
}

/** Picks exercises for one split day from what the user can reach. */
export function pickExercises(
  day: SplitDay,
  library: ExerciseRow[],
  equipment: Set<string>,
  level: string | null,
  totalSets: number,
): { exercise: ExerciseRow; sets: number; repLow: number; repTop: number }[] {
  const usable = library.filter(
    (e) => e.equipment !== null && equipment.has(e.equipment) && e.muscle_group !== 'mobility',
  );

  const perGroup = Math.max(1, Math.floor(totalSets / (day.focus.length * 3)));
  const chosen: ExerciseRow[] = [];

  for (const group of day.focus) {
    const candidates = usable
      .filter((e) => e.muscle_group === group)
      // Prefer compounds (barbell, bodyweight, pull-up bar) before isolation.
      .sort((a, b) => rank(a, level) - rank(b, level));

    for (const candidate of candidates.slice(0, perGroup)) {
      if (!chosen.some((c) => c.id === candidate.id)) chosen.push(candidate);
    }
  }

  const setsEach = Math.max(2, Math.min(4, Math.round(totalSets / Math.max(1, chosen.length))));

  return chosen.map((exercise) => {
    const range = repRange(Boolean(exercise.is_bodyweight), level);
    return { exercise, sets: setsEach, repLow: range.low, repTop: range.top };
  });
}

/** Lower sorts first. Keeps the plan compound-first and level-appropriate. */
function rank(exercise: ExerciseRow, level: string | null): number {
  const compound = exercise.equipment === 'barbell' || exercise.equipment === 'pull_up_bar' ? 0 : 1;
  const levelGap = exercise.level === level ? 0 : exercise.level === 'beginner' ? 1 : 2;
  return compound * 10 + levelGap;
}

export interface SessionPlan {
  day: SplitDay;
  exercises: PlannedExercise[];
}

/** Builds the plan for the user's next session. */
export async function buildSessionPlan(profile: ProfileRow): Promise<SessionPlan> {
  const supabase = await createClient();

  const [{ data: library }, { count }] = await Promise.all([
    supabase.from('exercises').select('*').order('id'),
    supabase
      .from('workout_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .not('finished_at', 'is', null),
  ]);

  const day = nextSplitDay(profile.days_per_week ?? 4, count ?? 0);
  const equipment = availableEquipment(profile.training_mode, profile.equipment);
  const planned = pickExercises(
    day,
    library ?? [],
    equipment as Set<string>,
    profile.fitness_level,
    setsForSession(profile.session_minutes ?? 45),
  );

  const previous = await loadPreviousBests(
    profile.id,
    planned.map((p) => p.exercise.id),
  );

  return {
    day,
    exercises: planned.map((p) => ({ ...p, previous: previous.get(p.exercise.id) ?? null })),
  };
}

/** Best previous numbers per exercise, for the inline "last time" line. */
export async function loadPreviousBests(
  userId: string,
  exerciseIds: number[],
): Promise<Map<number, NonNullable<PlannedExercise['previous']>>> {
  const result = new Map<number, NonNullable<PlannedExercise['previous']>>();
  if (exerciseIds.length === 0) return result;

  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('id, finished_at')
    .eq('user_id', userId)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return result;

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('*')
    .in('session_id', sessionIds)
    .in('exercise_id', exerciseIds);

  if (!sets) return result;

  // Sessions come back newest first, so the first set seen per exercise is the
  // most recent one.
  const order = new Map(sessionIds.map((id, index) => [id, index]));
  const byExercise = new Map<number, WorkoutSetRow[]>();
  for (const set of sets) {
    const list = byExercise.get(set.exercise_id) ?? [];
    list.push(set);
    byExercise.set(set.exercise_id, list);
  }

  for (const [exerciseId, list] of byExercise) {
    const sorted = [...list].sort(
      (a, b) => (order.get(a.session_id) ?? 0) - (order.get(b.session_id) ?? 0),
    );
    const mostRecent = sorted[0];

    result.set(exerciseId, {
      bestReps: bestReps(list),
      best1RM: bestEstimated1RM(list),
      lastWeightKg: mostRecent?.weight_kg ?? null,
      lastReps: mostRecent?.reps ?? null,
    });
  }

  return result;
}

/** Today's in-progress session, if there is one. */
export async function findOpenSession(profile: ProfileRow) {
  const supabase = await createClient();
  const today = localDate(profile.timezone ?? '');

  const { data } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', profile.id)
    .eq('session_date', today)
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}
