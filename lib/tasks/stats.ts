import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { computeStreak, summariseDays, type DaySummary, type StreakResult } from '@/lib/calc/streak';
import { computePoints, todayProgress, type PointsBreakdown, type TodayProgress } from '@/lib/calc/points';

/**
 * Streak and points are derived, not stored — the live schema has no columns
 * for them. Deriving keeps them honest: they cannot drift from the logs, and a
 * corrected log immediately corrects the totals.
 */

export interface DisciplineStats {
  streak: StreakResult;
  points: PointsBreakdown;
  today: TodayProgress;
  /** Per-day completion, oldest first. Feeds the heatmap in Phase 12. */
  days: DaySummary[];
}

export async function loadDisciplineStats(
  userId: string,
  today: string,
): Promise<DisciplineStats> {
  const supabase = await createClient();

  const logsQuery = supabase
    .from('daily_logs')
    .select('log_date, completed, user_task_id')
    .eq('user_id', userId);
  // Which tasks are active right now. Used to keep tasks the user has just
  // switched off out of today's denominator.
  const activeTasksQuery = supabase
    .from('user_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true);
  const workoutsQuery = supabase
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null);
  const checkinsQuery = supabase.from('checkins').select('id').eq('user_id', userId);

  const [logsResult, activeTasksResult, workoutsResult, checkinsResult] = await Promise.all([
    logsQuery,
    activeTasksQuery,
    workoutsQuery,
    checkinsQuery,
  ]);

  const activeTaskIds = new Set((activeTasksResult.data ?? []).map((t) => t.id));

  const days = summariseDays(
    (logsResult.data ?? []).map((row) => ({
      log_date: row.log_date,
      completed: row.completed,
      active: activeTaskIds.has(row.user_task_id),
    })),
    today,
  );
  const todayRow = days.find((d) => d.date === today) ?? { date: today, completed: 0, active: 0 };

  return {
    streak: computeStreak(days, today),
    points: computePoints({
      days,
      workoutSessions: workoutsResult.data?.length ?? 0,
      checkins: checkinsResult.data?.length ?? 0,
    }),
    today: todayProgress(todayRow),
    days,
  };
}
