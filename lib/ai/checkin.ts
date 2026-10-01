import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/lib/supabase/types';
import { localDate, shiftDate } from '@/lib/calc/day';
import { summariseDays } from '@/lib/calc/streak';
import { sessionVolume } from '@/lib/calc/progression';
import { movingAverage, weightTrend } from '@/lib/calc/body';
import { autoAdjustCalories, type AdjustResult } from '@/lib/calc/adjust';
import { tdee as computeTdee } from '@/lib/calc/tdee';

/**
 * The week's data for the §8.9 check-in.
 *
 * Everything the model sees is summarised here, and the same snapshot is
 * stored on the checkin row so a past review can be re-read with the numbers
 * it was actually based on.
 */

export interface CheckinSnapshot {
  week: number;
  adherence_pct: number | null;
  weight_avg_kg: number | null;
  weight_change_this_week_kg: number | null;
  weight_change_last_week_kg: number | null;
  measurements: Record<string, number | null>;
  sessions_this_week: number;
  volume_trend_kg: number[];
  avg_sleep_hours: number | null;
  avg_recovery_inputs: { quality: number | null; soreness: number | null };
  breakout_trend: number[];
  calorie_target: number | null;
  avg_calories_logged: number | null;
  avg_protein_logged: number | null;
  user_notes: string;
  pain_notes: string;
  energy: number | null;
  hunger: number | null;
}

export interface CheckinContext {
  snapshot: CheckinSnapshot;
  /** The deterministic §6 adjustment, computed before the model is asked. */
  autoAdjust: AdjustResult;
  maintenanceCalories: number;
}

export async function buildCheckinContext(
  profile: ProfileRow,
  week: number,
  input: { energy: number | null; hunger: number | null; notes: string; painNotes: string },
): Promise<CheckinContext> {
  const supabase = await createClient();
  const today = localDate(profile.timezone ?? '');
  const weekAgo = shiftDate(today, -7);
  const twoWeeksAgo = shiftDate(today, -14);

  const [logs, measurements, sessions, sleep, skin, food] = await Promise.all([
    supabase
      .from('daily_logs')
      .select('log_date, completed')
      .eq('user_id', profile.id)
      .gte('log_date', weekAgo),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('user_id', profile.id)
      .gte('log_date', shiftDate(today, -28))
      .order('log_date', { ascending: true }),
    supabase
      .from('workout_sessions')
      .select('id, session_date, session_rpe, soreness')
      .eq('user_id', profile.id)
      .not('finished_at', 'is', null)
      .gte('session_date', weekAgo),
    supabase
      .from('sleep_logs')
      .select('hours, quality')
      .eq('user_id', profile.id)
      .gte('log_date', weekAgo),
    supabase
      .from('skin_logs')
      .select('log_date, breakouts')
      .eq('user_id', profile.id)
      .gte('log_date', twoWeeksAgo)
      .order('log_date', { ascending: true }),
    supabase
      .from('food_entries')
      .select('log_date, calories, protein_g')
      .eq('user_id', profile.id)
      .gte('log_date', weekAgo),
  ]);

  const days = summariseDays(logs.data ?? []);
  const totalActive = days.reduce((s, d) => s + d.active, 0);
  const totalDone = days.reduce((s, d) => s + d.completed, 0);

  const rows = measurements.data ?? [];
  const weighIns = rows
    .filter((m) => typeof m.weight_kg === 'number')
    .map((m) => ({ date: m.log_date, weightKg: Number(m.weight_kg) }));

  const trend = weightTrend(weighIns);
  const points = movingAverage(weighIns);

  // The week before last, for spotting a two-week stall.
  const olderPoints = points.filter((p) => p.date <= weekAgo);
  const previousTrend = weightTrend(
    weighIns.filter((w) => w.date <= weekAgo),
  );

  const latest = rows[rows.length - 1];
  const sessionIds = (sessions.data ?? []).map((s) => s.id);

  let volumeTrend: number[] = [];
  if (sessionIds.length > 0) {
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('session_id, reps, weight_kg')
      .in('session_id', sessionIds);
    volumeTrend = sessionIds.map((id) =>
      sessionVolume((sets ?? []).filter((s) => s.session_id === id)),
    );
  }

  const foodByDate = new Map<string, { calories: number; protein: number }>();
  for (const entry of food.data ?? []) {
    const bucket = foodByDate.get(entry.log_date) ?? { calories: 0, protein: 0 };
    bucket.calories += entry.calories ?? 0;
    bucket.protein += Number(entry.protein_g ?? 0);
    foodByDate.set(entry.log_date, bucket);
  }

  const snapshot: CheckinSnapshot = {
    week,
    adherence_pct: totalActive > 0 ? Math.round((totalDone / totalActive) * 100) : null,
    weight_avg_kg: trend.currentKg,
    weight_change_this_week_kg: trend.weeklyChangeKg,
    weight_change_last_week_kg: previousTrend.weeklyChangeKg,
    measurements: {
      waist_cm: latest?.waist_cm ?? null,
      chest_cm: latest?.chest_cm ?? null,
      arm_cm: latest?.arm_cm ?? null,
      thigh_cm: latest?.thigh_cm ?? null,
      body_fat_pct: latest?.body_fat_pct ?? null,
    },
    sessions_this_week: sessionIds.length,
    volume_trend_kg: volumeTrend,
    avg_sleep_hours: average((sleep.data ?? []).map((s) => s.hours)),
    avg_recovery_inputs: {
      quality: average((sleep.data ?? []).map((s) => s.quality)),
      soreness: average((sessions.data ?? []).map((s) => s.soreness)),
    },
    breakout_trend: (skin.data ?? [])
      .map((s) => s.breakouts)
      .filter((b): b is number => typeof b === 'number'),
    calorie_target: profile.calorie_target,
    avg_calories_logged: average([...foodByDate.values()].map((v) => v.calories)),
    avg_protein_logged: average([...foodByDate.values()].map((v) => v.protein)),
    user_notes: input.notes,
    pain_notes: input.painNotes,
    energy: input.energy,
    hunger: input.hunger,
  };

  const maintenanceCalories =
    profile.sex && profile.age && profile.height_cm && profile.weight_kg && profile.activity_level
      ? computeTdee(
          {
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.height_cm,
            weightKg: profile.weight_kg,
          },
          profile.activity_level,
        )
      : (profile.calorie_target ?? 2200);

  // §6 runs regardless of whether the model answers, so the adjustment is
  // deterministic and the AI can only ever agree or be overruled.
  const autoAdjust = autoAdjustCalories({
    goal: profile.goal ?? 'discipline',
    sex: profile.sex ?? 'male',
    age: profile.age ?? 25,
    weightKg: profile.weight_kg ?? 70,
    currentCalories: profile.calorie_target ?? maintenanceCalories,
    maintenanceCalories,
    weeklyChangeKg: trend.weeklyChangeKg,
    previousWeeklyChangeKg: previousTrend.weeklyChangeKg,
  });

  void olderPoints;

  return { snapshot, autoAdjust, maintenanceCalories };
}

function average(values: (number | null)[]): number | null {
  const numbers = values.filter((v): v is number => typeof v === 'number');
  if (numbers.length === 0) return null;
  return Math.round((numbers.reduce((a, b) => a + b, 0) / numbers.length) * 10) / 10;
}
