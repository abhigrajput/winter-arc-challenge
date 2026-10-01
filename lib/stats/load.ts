import 'server-only';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import type { ProfileRow } from '@/lib/supabase/types';
import { challengeDay, localDate } from '@/lib/calc/day';
import { summariseDays, type DaySummary } from '@/lib/calc/streak';
import { loadDisciplineStats, type DisciplineStats } from '@/lib/tasks/stats';
import { sessionVolume } from '@/lib/calc/progression';
import { movingAverage, weightTrend, type TrendPoint, type WeightTrend } from '@/lib/calc/body';
import { bodyFatRange, VISIBLE_ABS_BODY_FAT } from '@/lib/calc/bodyfat';
import { weeksToBodyFat } from '@/lib/calc/projection';
import { earnedAchievements, type AchievementInput } from '@/lib/achievements';

/**
 * Everything /stats and /achievements need, in one pass.
 *
 * Achievements are evaluated here and persisted, so a badge earned while the
 * user was not looking still shows up the next time they open the app.
 */

export interface AbsEta {
  currentBodyFat: number;
  targetLow: number;
  targetHigh: number;
  weeksLow: number;
  weeksHigh: number;
}

export interface StatsBundle {
  logDate: string;
  day: number;
  discipline: DisciplineStats;
  weightPoints: TrendPoint[];
  weightTrend: WeightTrend;
  volumeByDate: { date: string; volume: number }[];
  bodyFat: { estimate: number; low: number; high: number } | null;
  absEta: AbsEta | null;
  totals: {
    sessions: number;
    personalRecords: number;
    suryaRounds: number;
    gitaChapters: number;
    contentPosts: number;
    checkins: number;
  };
  earnedCodes: Set<string>;
}

export async function loadStats(profile: ProfileRow): Promise<StatsBundle> {
  const supabase = await createClient();
  const logDate = localDate(profile.timezone ?? '');
  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');

  const discipline = await loadDisciplineStats(profile.id, logDate);

  const [measurements, sessions, prs, surya, gita, posts, checkins, pullUp] = await Promise.all([
    supabase
      .from('body_measurements')
      .select('log_date, weight_kg, body_fat_pct')
      .eq('user_id', profile.id)
      .order('log_date', { ascending: true }),
    supabase
      .from('workout_sessions')
      .select('id, session_date')
      .eq('user_id', profile.id)
      .not('finished_at', 'is', null)
      .order('session_date', { ascending: true }),
    supabase
      .from('workout_sets')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_pr', true),
    suryaTotal(profile.id),
    supabase.from('gita_progress').select('chapter').eq('user_id', profile.id),
    supabase.from('content_posts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
    bestPullUpReps(profile.id),
  ]);

  const rows = measurements.data ?? [];
  const weighIns = rows
    .filter((m) => typeof m.weight_kg === 'number')
    .map((m) => ({ date: m.log_date, weightKg: Number(m.weight_kg) }));

  const trend = weightTrend(weighIns);
  const points = movingAverage(weighIns);

  const sessionRows = sessions.data ?? [];
  let volumeByDate: { date: string; volume: number }[] = [];
  if (sessionRows.length > 0) {
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('session_id, reps, weight_kg')
      .in(
        'session_id',
        sessionRows.map((s) => s.id),
      );

    volumeByDate = sessionRows.map((session) => ({
      date: session.session_date,
      volume: sessionVolume((sets ?? []).filter((s) => s.session_id === session.id)),
    }));
  }

  const latestBodyFat = [...rows]
    .reverse()
    .find((m) => typeof m.body_fat_pct === 'number')?.body_fat_pct;

  const bodyFat =
    typeof latestBodyFat === 'number'
      ? { estimate: Number(latestBodyFat), ...bodyFatRange(Number(latestBodyFat)) }
      : null;

  // §8.2 Abs ETA, shown as a range and only while actually losing.
  const absTarget = VISIBLE_ABS_BODY_FAT[profile.sex ?? 'male'];
  const eta =
    bodyFat && trend.weeklyChangeKg !== null && profile.weight_kg
      ? weeksToBodyFat(bodyFat.estimate, absTarget.high, trend.weeklyChangeKg, profile.weight_kg)
      : null;

  const achievementInput: AchievementInput = {
    days: discipline.days,
    longestStreak: discipline.streak.longest,
    workoutSessions: sessionRows.length,
    personalRecords: prs.count ?? 0,
    bestPullUpReps: pullUp,
    suryaRounds: surya,
    gitaChapters: (gita.data ?? []).length,
    contentPosts: posts.count ?? 0,
    challengeDay: day,
  };

  const earnedCodes = await syncAchievements(profile.id, earnedAchievements(achievementInput));

  return {
    logDate,
    day,
    discipline,
    weightPoints: points,
    weightTrend: trend,
    volumeByDate,
    bodyFat,
    absEta:
      eta && bodyFat
        ? {
            currentBodyFat: bodyFat.estimate,
            targetLow: absTarget.low,
            targetHigh: absTarget.high,
            weeksLow: eta.low,
            weeksHigh: eta.high,
          }
        : null,
    totals: {
      sessions: sessionRows.length,
      personalRecords: prs.count ?? 0,
      suryaRounds: surya,
      gitaChapters: (gita.data ?? []).length,
      contentPosts: posts.count ?? 0,
      checkins: checkins.count ?? 0,
    },
    earnedCodes,
  };
}

/**
 * Writes any newly earned badges and returns the full earned set.
 *
 * Badges are granted with the service-role client, not the user's. The live
 * database has no INSERT policy on achievements for ordinary users, which is
 * the right call: badges show on the public profile (§8.12), so a user must
 * not be able to award themselves one. The write is still scoped to the
 * authenticated user id that was passed in.
 *
 * Safe to call on every page load — conflicts are ignored.
 */
async function syncAchievements(userId: string, earned: string[]): Promise<Set<string>> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('achievements')
    .select('code')
    .eq('user_id', userId);

  const already = new Set((existing ?? []).map((row) => row.code));
  const fresh = earned.filter((code) => !already.has(code));

  if (fresh.length > 0) {
    const service = createServiceClient();
    await service
      .from('achievements')
      .upsert(
        fresh.map((code) => ({ user_id: userId, code, earned_at: new Date().toISOString() })),
        { onConflict: 'user_id,code', ignoreDuplicates: true },
      );
  }

  return new Set([...already, ...earned]);
}

/** Total Surya Namaskar rounds across every day logged. */
async function suryaTotal(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', 'surya_namaskar')
    .maybeSingle();
  if (!template) return 0;

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .maybeSingle();
  if (!task) return 0;

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('value')
    .eq('user_id', userId)
    .eq('user_task_id', task.id);

  return Math.round((logs ?? []).reduce((sum, row) => sum + Number(row.value ?? 0), 0));
}

/** Best single-set reps on a full pull-up, for the first-pull-up badge. */
async function bestPullUpReps(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: exercise } = await supabase
    .from('exercises')
    .select('id')
    .eq('slug', 'pull_up')
    .maybeSingle();
  if (!exercise) return 0;

  const { data: sets } = await supabase
    .from('workout_sets')
    .select('reps')
    .eq('user_id', userId)
    .eq('exercise_id', exercise.id);

  return (sets ?? []).reduce((best, row) => Math.max(best, row.reps ?? 0), 0);
}

/** Groups day summaries into weeks for the heatmap. */
export function heatmapWeeks(days: DaySummary[], startDate: string | null): DaySummary[][] {
  if (!startDate) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks: DaySummary[][] = [];

  for (let week = 0; week < 13; week += 1) {
    const row: DaySummary[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = addDays(startDate, week * 7 + offset);
      row.push(byDate.get(date) ?? { date, completed: 0, active: 0 });
    }
    weeks.push(row);
  }

  return weeks;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export { summariseDays };
