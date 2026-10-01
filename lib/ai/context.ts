import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/lib/supabase/types';
import { localDate, shiftDate } from '@/lib/calc/day';
import { summariseDays } from '@/lib/calc/streak';
import { sessionVolume } from '@/lib/calc/progression';

/**
 * The recent-data block injected into every prompt (§8.9).
 *
 * Kept small and already summarised: the model gets trends, not raw rows, so
 * the prompt stays cheap and the numbers cannot be misread.
 */
export async function buildRecentContext(
  userId: string,
  profile: ProfileRow,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const today = localDate(profile.timezone ?? '');
  const fourteenDaysAgo = shiftDate(today, -14);

  const [logs, weights, sessions, skin, sleep] = await Promise.all([
    supabase
      .from('daily_logs')
      .select('log_date, completed')
      .eq('user_id', userId)
      .gte('log_date', fourteenDaysAgo),
    supabase
      .from('body_measurements')
      .select('log_date, weight_kg, waist_cm, body_fat_pct')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(4),
    supabase
      .from('workout_sessions')
      .select('id, session_date, plan_day, session_rpe, notes')
      .eq('user_id', userId)
      .not('finished_at', 'is', null)
      .order('session_date', { ascending: false })
      .limit(6),
    supabase
      .from('skin_logs')
      .select('log_date, breakouts')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(7),
    supabase
      .from('sleep_logs')
      .select('hours')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(7),
  ]);

  const days = summariseDays(logs.data ?? []);
  const totalActive = days.reduce((sum, d) => sum + d.active, 0);
  const totalDone = days.reduce((sum, d) => sum + d.completed, 0);

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

  const sleepHours = (sleep.data ?? [])
    .map((s) => s.hours)
    .filter((h): h is number => typeof h === 'number');

  const breakouts = (skin.data ?? [])
    .map((s) => s.breakouts)
    .filter((b): b is number => typeof b === 'number');

  // Surfaced separately because §10 requires an injury to change the plan.
  const injuryNote = (sessions.data ?? [])
    .map((s) => s.notes)
    .find((note) => note && /\b(pain|injur|hurt|tweak|strain)\b/i.test(note));

  return {
    adherence_pct: totalActive > 0 ? Math.round((totalDone / totalActive) * 100) : null,
    days_logged: days.length,
    weight_trend_kg: (weights.data ?? []).map((w) => w.weight_kg).filter(Boolean),
    waist_trend_cm: (weights.data ?? []).map((w) => w.waist_cm).filter(Boolean),
    latest_body_fat_pct: weights.data?.[0]?.body_fat_pct ?? null,
    recent_sessions: (sessions.data ?? []).map((s) => ({
      date: s.session_date,
      day: s.plan_day,
      rpe: s.session_rpe,
    })),
    session_volume_trend_kg: volumeTrend,
    avg_sleep_hours: average(sleepHours),
    avg_breakout_score: average(breakouts),
    injury_note: injuryNote ?? null,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}
