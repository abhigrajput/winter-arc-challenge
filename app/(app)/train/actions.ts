'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { challengeDay, localDate, phaseForDay } from '@/lib/calc/day';
import { bestEstimated1RM, bestReps, detectPr } from '@/lib/calc/progression';
import { availableEquipment, nextSplitDay } from '@/lib/workout/splits';

/**
 * Workout logging (§8.1).
 *
 * Sets are written one at a time so nothing is lost if the phone dies
 * mid-session. PRs are worked out when the session is finished, against every
 * set the user has ever logged for that exercise.
 */

export interface WorkoutResult {
  error?: string;
}

async function context() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) redirect('/login');
  return { supabase, profile };
}

/** Starts today's session, or returns the one already open. */
export async function startSession(): Promise<void> {
  const { supabase, profile } = await context();
  const today = localDate(profile.timezone ?? '');

  const { data: open } = await supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', profile.id)
    .eq('session_date', today)
    .is('finished_at', null)
    .limit(1)
    .maybeSingle();

  if (open) redirect(`/train/${open.id}`);

  const { count } = await supabase
    .from('workout_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .not('finished_at', 'is', null);

  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');
  const split = nextSplitDay(profile.days_per_week ?? 4, count ?? 0);

  const { data: created, error } = await supabase
    .from('workout_sessions')
    .insert({
      user_id: profile.id,
      session_date: today,
      plan_week: phaseForDay(day).week,
      plan_day: split.name,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (error || !created) redirect('/train?error=start');

  revalidatePath('/train');
  redirect(`/train/${created.id}`);
}

const logSetInput = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.number().int().positive(),
  setNo: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(500).nullable(),
  weightKg: z.number().min(0).max(500).nullable(),
  durationSec: z.number().int().min(0).max(7200).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
});

/** Saves or replaces one set. */
export async function logSet(input: unknown): Promise<WorkoutResult> {
  const parsed = logSetInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid set.' };

  const { supabase, profile } = await context();
  const { sessionId, exerciseId, setNo, reps, weightKg, durationSec, rpe } = parsed.data;

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('id, finished_at')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!session) return { error: 'Session not found.' };
  if (session.finished_at) return { error: 'That session is already finished.' };

  const { data: existing } = await supabase
    .from('workout_sets')
    .select('id')
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId)
    .eq('set_no', setNo)
    .maybeSingle();

  const payload = {
    session_id: sessionId,
    user_id: profile.id,
    exercise_id: exerciseId,
    set_no: setNo,
    reps,
    weight_kg: weightKg,
    duration_sec: durationSec,
    rpe,
  };

  const { error } = existing
    ? await supabase.from('workout_sets').update(payload).eq('id', existing.id)
    : await supabase.from('workout_sets').insert(payload);

  if (error) return { error: 'Could not save the set.' };

  revalidatePath(`/train/${sessionId}`);
  return {};
}

const deleteSetInput = z.object({
  sessionId: z.string().uuid(),
  exerciseId: z.number().int().positive(),
  setNo: z.number().int().min(1).max(20),
});

export async function deleteSet(input: unknown): Promise<WorkoutResult> {
  const parsed = deleteSetInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();

  const { error } = await supabase
    .from('workout_sets')
    .delete()
    .eq('user_id', profile.id)
    .eq('session_id', parsed.data.sessionId)
    .eq('exercise_id', parsed.data.exerciseId)
    .eq('set_no', parsed.data.setNo);

  if (error) return { error: 'Could not remove the set.' };

  revalidatePath(`/train/${parsed.data.sessionId}`);
  return {};
}

const finishInput = z.object({
  sessionId: z.string().uuid(),
  notes: z.string().trim().max(500).optional(),
  sessionRpe: z.number().int().min(1).max(10).nullable().optional(),
});

/**
 * Closes the session: marks PRs, stamps finished_at, and ticks off the
 * workout task for the day.
 */
export async function finishSession(input: unknown): Promise<WorkoutResult> {
  const parsed = finishInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();
  const { sessionId, notes, sessionRpe } = parsed.data;

  const { data: session } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!session) return { error: 'Session not found.' };
  if (session.finished_at) return { error: 'Already finished.' };

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('*')
    .eq('session_id', sessionId);

  if (!sets || sets.length === 0) {
    return { error: 'Log at least one set before finishing.' };
  }

  await markPersonalRecords(supabase, profile.id, sessionId, sets);

  await supabase
    .from('workout_sessions')
    .update({
      finished_at: new Date().toISOString(),
      notes: notes || null,
      session_rpe: sessionRpe ?? null,
    })
    .eq('id', sessionId)
    .eq('user_id', profile.id);

  await completeWorkoutTask(supabase, profile.id, profile.timezone ?? '');

  revalidatePath('/train');
  revalidatePath('/today');
  redirect(`/train/${sessionId}/summary`);
}

type Supa = Awaited<ReturnType<typeof context>>['supabase'];
type SetRow = { exercise_id: number; reps: number | null; weight_kg: number | null; id: string };

/** Flags the sets that beat the user's previous best for that exercise. */
async function markPersonalRecords(
  supabase: Supa,
  userId: string,
  sessionId: string,
  sets: SetRow[],
): Promise<void> {
  const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
  if (exerciseIds.length === 0) return;

  const [{ data: library }, { data: history }] = await Promise.all([
    supabase.from('exercises').select('id, is_bodyweight').in('id', exerciseIds),
    supabase
      .from('workout_sets')
      .select('exercise_id, reps, weight_kg, session_id')
      .eq('user_id', userId)
      .in('exercise_id', exerciseIds)
      .neq('session_id', sessionId),
  ]);

  const bodyweight = new Map((library ?? []).map((e) => [e.id, Boolean(e.is_bodyweight)]));

  for (const exerciseId of exerciseIds) {
    const isBodyweight = bodyweight.get(exerciseId) ?? false;
    const past = (history ?? []).filter((s) => s.exercise_id === exerciseId);
    const current = sets.filter((s) => s.exercise_id === exerciseId);

    const previousBest = isBodyweight ? bestReps(past) : bestEstimated1RM(past);
    const check = detectPr(current, previousBest, isBodyweight);
    if (!check.isPr) continue;

    // Mark the single best set of this session for that exercise.
    const score = (s: SetRow) =>
      isBodyweight ? (s.reps ?? 0) : (s.weight_kg ?? 0) * (1 + (s.reps ?? 0) / 30);
    const best = [...current].sort((a, b) => score(b) - score(a))[0];
    if (best) {
      await supabase.from('workout_sets').update({ is_pr: true }).eq('id', best.id);
    }
  }
}

/**
 * §8.1: finishing a session auto-completes the workout task for the day.
 * Matches on the seeded template rather than the title, which the user may
 * have renamed.
 */
async function completeWorkoutTask(supabase: Supa, userId: string, timezone: string) {
  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', 'workout')
    .maybeSingle();

  if (!template) return;

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id, target')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .eq('active', true)
    .maybeSingle();

  if (!task) return;

  await supabase
    .from('daily_logs')
    .update({
      completed: true,
      value: task.target ?? 1,
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('user_task_id', task.id)
    .eq('log_date', localDate(timezone));
}

const swapInput = z.object({
  sessionId: z.string().uuid(),
  fromExerciseId: z.number().int().positive(),
  toExerciseId: z.number().int().positive(),
});

/**
 * §8.1 swap: replace an exercise with another that hits the same muscle group
 * and uses equipment the user actually has. Any sets already logged for the
 * old exercise move across, so a mid-session swap does not lose work.
 */
export async function swapExercise(input: unknown): Promise<WorkoutResult> {
  const parsed = swapInput.safeParse(input);
  if (!parsed.success) return { error: 'Invalid request.' };

  const { supabase, profile } = await context();
  const { sessionId, fromExerciseId, toExerciseId } = parsed.data;

  const { data: pair } = await supabase
    .from('exercises')
    .select('id, muscle_group, equipment')
    .in('id', [fromExerciseId, toExerciseId]);

  const from = pair?.find((e) => e.id === fromExerciseId);
  const to = pair?.find((e) => e.id === toExerciseId);
  if (!from || !to) return { error: 'Exercise not found.' };

  if (from.muscle_group !== to.muscle_group) {
    return { error: 'Pick a replacement for the same muscle group.' };
  }

  const reachable = availableEquipment(profile.training_mode, profile.equipment);
  if (!to.equipment || !reachable.has(to.equipment as never)) {
    return { error: 'You do not have the equipment for that one.' };
  }

  const { error } = await supabase
    .from('workout_sets')
    .update({ exercise_id: toExerciseId })
    .eq('user_id', profile.id)
    .eq('session_id', sessionId)
    .eq('exercise_id', fromExerciseId);

  if (error) return { error: 'Could not swap. Try again.' };

  revalidatePath(`/train/${sessionId}`);
  return {};
}
