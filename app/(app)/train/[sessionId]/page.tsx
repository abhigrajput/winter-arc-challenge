import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { buildSessionPlan } from '@/lib/workout/session';
import { availableEquipment } from '@/lib/workout/splits';
import { SessionLogger } from '@/components/train/session-logger';
import type { LoggerExercise } from '@/components/train/exercise-logger';

export const metadata: Metadata = { title: 'Logging' };
export const dynamic = 'force-dynamic';

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { profile } = await requireUser();
  if (!profile) return null;

  const supabase = await createClient();

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!session) notFound();
  if (session.finished_at) redirect(`/train/${sessionId}/summary`);

  const [plan, { data: sets }, { data: library }] = await Promise.all([
    buildSessionPlan(profile),
    supabase.from('workout_sets').select('*').eq('session_id', sessionId).order('set_no'),
    supabase.from('exercises').select('*'),
  ]);

  const reachable = availableEquipment(profile.training_mode, profile.equipment);
  const byId = new Map((library ?? []).map((e) => [e.id, e]));

  // Exercises in the plan, plus anything already logged that the plan dropped
  // (for instance after a swap).
  const plannedIds = plan.exercises.map((p) => p.exercise.id);
  const loggedIds = [...new Set((sets ?? []).map((s) => s.exercise_id))];
  const extraIds = loggedIds.filter((id) => !plannedIds.includes(id));

  const exercises: LoggerExercise[] = [
    ...plan.exercises.map((planned) => ({
      id: planned.exercise.id,
      name: planned.exercise.name,
      muscleGroup: planned.exercise.muscle_group ?? '',
      isBodyweight: Boolean(planned.exercise.is_bodyweight),
      cues: planned.exercise.cues ?? [],
      mistakes: planned.exercise.mistakes ?? [],
      plannedSets: planned.sets,
      repLow: planned.repLow,
      repTop: planned.repTop,
      previous: planned.previous,
      sets: setsFor(planned.exercise.id),
      alternatives: alternativesFor(planned.exercise.id, planned.exercise.muscle_group),
    })),
    ...extraIds.flatMap((id) => {
      const exercise = byId.get(id);
      if (!exercise) return [];
      return [
        {
          id: exercise.id,
          name: exercise.name,
          muscleGroup: exercise.muscle_group ?? '',
          isBodyweight: Boolean(exercise.is_bodyweight),
          cues: exercise.cues ?? [],
          mistakes: exercise.mistakes ?? [],
          plannedSets: setsFor(id).length,
          repLow: 6,
          repTop: 12,
          previous: null,
          sets: setsFor(id),
          alternatives: alternativesFor(id, exercise.muscle_group),
        },
      ];
    }),
  ];

  function setsFor(exerciseId: number) {
    return (sets ?? [])
      .filter((s) => s.exercise_id === exerciseId)
      .map((s) => ({
        setNo: s.set_no,
        reps: s.reps,
        weightKg: s.weight_kg,
        rpe: s.rpe,
        isPr: Boolean(s.is_pr),
      }));
  }

  function alternativesFor(exerciseId: number, muscleGroup: string | null) {
    if (!muscleGroup) return [];
    return (library ?? [])
      .filter(
        (e) =>
          e.id !== exerciseId &&
          e.muscle_group === muscleGroup &&
          e.equipment !== null &&
          reachable.has(e.equipment as never),
      )
      .slice(0, 6)
      .map((e) => ({ id: e.id, name: e.name }));
  }

  return (
    <SessionLogger
      sessionId={sessionId}
      dayName={session.plan_day ?? plan.day.name}
      startedAt={session.started_at}
      exercises={exercises}
    />
  );
}
