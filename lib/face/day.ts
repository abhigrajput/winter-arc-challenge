import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ProfileRow, SkinLogRow } from '@/lib/supabase/types';
import { localDate, shiftDate } from '@/lib/calc/day';
import { correlate, type CorrelationResult } from '@/lib/calc/correlation';
import { needsDermReferral } from '@/lib/face/routine';

/**
 * Skin log data (§8.3) and the correlation card.
 *
 * Correlations are computed over the last 60 days of overlapping entries.
 * Each factor is paired only with days that have both values, so a missing
 * sleep log weakens that one card rather than the whole set.
 */

export const CORRELATION_WINDOW_DAYS = 60;

export interface FaceDay {
  logDate: string;
  today: SkinLogRow | null;
  /** Oldest first, for the trend chart. */
  history: SkinLogRow[];
  correlations: { key: string; label: string; result: CorrelationResult }[];
  dermReferral: boolean;
  /** Weekly averages of the breakout score, oldest first. */
  weeklyTrend: { week: string; average: number; days: number }[];
}

export async function loadFaceDay(profile: ProfileRow, now: Date = new Date()): Promise<FaceDay> {
  const supabase = await createClient();
  const logDate = localDate(profile.timezone ?? '', now);
  const since = shiftDate(logDate, -CORRELATION_WINDOW_DAYS);

  const [skin, sleep, water, junk] = await Promise.all([
    supabase
      .from('skin_logs')
      .select('*')
      .eq('user_id', profile.id)
      .gte('log_date', since)
      .order('log_date', { ascending: true }),
    supabase
      .from('sleep_logs')
      .select('log_date, hours')
      .eq('user_id', profile.id)
      .gte('log_date', since),
    supabase
      .from('water_logs')
      .select('log_date, ml')
      .eq('user_id', profile.id)
      .gte('log_date', since),
    loadJunkTaskByDate(profile.id, since),
  ]);

  const history = skin.data ?? [];
  const today = history.find((row) => row.log_date === logDate) ?? null;

  const scoreByDate = new Map(
    history
      .filter((row) => typeof row.breakouts === 'number')
      .map((row) => [row.log_date, row.breakouts as number]),
  );

  const pairsFrom = <T>(rows: T[], date: (r: T) => string | null, value: (r: T) => number | null) =>
    rows
      .map((row) => {
        const d = date(row);
        const v = value(row);
        const score = d ? scoreByDate.get(d) : undefined;
        return d !== null && v !== null && score !== undefined ? { x: v, y: score } : null;
      })
      .filter((p): p is { x: number; y: number } => p !== null);

  const correlations = [
    {
      key: 'sleep',
      label: 'sleep hours',
      result: correlate({
        pairs: pairsFrom(sleep.data ?? [], (r) => r.log_date, (r) => r.hours),
        factorLabel: 'sleep',
      }),
    },
    {
      key: 'water',
      label: 'water',
      result: correlate({
        pairs: pairsFrom(water.data ?? [], (r) => r.log_date, (r) => (r.ml === null ? null : r.ml / 1000)),
        factorLabel: 'water',
      }),
    },
    {
      key: 'junk',
      label: 'sugar and junk',
      result: correlate({
        // The task is "no junk", so completing it means less junk. Invert it so
        // the factor reads as junk eaten rather than the task being done.
        pairs: pairsFrom(junk, (r) => r.date, (r) => (r.completed ? 0 : 1)),
        factorLabel: 'junk food',
      }),
    },
    {
      key: 'dairy',
      label: 'dairy',
      result: correlate({
        pairs: pairsFrom(history, (r) => r.log_date, (r) => (r.dairy === null ? null : r.dairy ? 1 : 0)),
        factorLabel: 'dairy',
      }),
    },
  ];

  const recentScores = [...history]
    .reverse()
    .map((row) => row.breakouts)
    .filter((s): s is number => typeof s === 'number')
    .slice(0, 7);

  return {
    logDate,
    today,
    history,
    correlations,
    dermReferral: needsDermReferral({
      recentScores,
      notes: history.map((row) => row.notes ?? '').join(' '),
    }),
    weeklyTrend: weeklyAverages(history),
  };
}

/** Groups breakout scores into calendar weeks for the §8.3 trend chart. */
export function weeklyAverages(
  rows: { log_date: string; breakouts: number | null }[],
): { week: string; average: number; days: number }[] {
  const buckets = new Map<string, number[]>();

  for (const row of rows) {
    if (typeof row.breakouts !== 'number') continue;
    const week = weekStart(row.log_date);
    const list = buckets.get(week) ?? [];
    list.push(row.breakouts);
    buckets.set(week, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, scores]) => ({
      week,
      average: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10,
      days: scores.length,
    }));
}

/** Monday of the week containing the given date. */
function weekStart(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

/** Completion of the "no junk" task, by date. */
async function loadJunkTaskByDate(
  userId: string,
  since: string,
): Promise<{ date: string; completed: boolean }[]> {
  const supabase = await createClient();

  const { data: template } = await supabase
    .from('task_templates')
    .select('id')
    .eq('slug', 'no_junk')
    .maybeSingle();

  if (!template) return [];

  const { data: task } = await supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('template_id', template.id)
    .maybeSingle();

  if (!task) return [];

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('log_date, completed')
    .eq('user_id', userId)
    .eq('user_task_id', task.id)
    .gte('log_date', since);

  return (logs ?? [])
    .filter((row): row is { log_date: string; completed: boolean | null } => row.log_date !== null)
    .map((row) => ({ date: row.log_date, completed: Boolean(row.completed) }));
}
