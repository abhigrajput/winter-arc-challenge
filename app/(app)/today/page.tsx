import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';
import { loadToday } from '@/lib/tasks/ensure';
import { loadDisciplineStats } from '@/lib/tasks/stats';
import { challengeDay, phaseForDay, shiftDate } from '@/lib/calc/day';
import { recoveryScore } from '@/lib/calc/recovery';
import { DayHeader } from '@/components/today/day-header';
import { FullDayCelebration } from '@/components/today/full-day';
import { TaskList, type TaskItem } from '@/components/today/task-list';
import { SleepCard, type SleepToday } from '@/components/today/sleep-card';
import { ContentTracker, GitaTracker, type ContentPost } from '@/components/today/mind-trackers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Today' };

// Always render fresh: "today" depends on the wall clock, not on a cache.
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const { logDate, tasks, logs } = await loadToday(profile);
  const stats = await loadDisciplineStats(profile.id, logDate);

  const supabase = await createClient();
  const yesterday = shiftDate(logDate, -1);

  const [{ data: templates }, { data: sleep }, { data: lastSession }, { data: gita }, { data: posts }] =
    await Promise.all([
      supabase.from('task_templates').select('id, slug'),
      supabase
        .from('sleep_logs')
        .select('*')
        .eq('user_id', profile.id)
        .eq('log_date', logDate)
        .maybeSingle(),
      supabase
        .from('workout_sessions')
        .select('session_rpe, soreness')
        .eq('user_id', profile.id)
        .eq('session_date', yesterday)
        .not('finished_at', 'is', null)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('gita_progress').select('chapter').eq('user_id', profile.id),
      supabase
        .from('content_posts')
        .select('*')
        .eq('user_id', profile.id)
        .gte('log_date', shiftDate(logDate, -7))
        .order('log_date', { ascending: false }),
    ]);

  const slugById = new Map((templates ?? []).map((t) => [t.id, t.slug]));
  const logByTask = new Map(logs.map((log) => [log.user_task_id, log]));

  const activeTasks = tasks.filter((task) => task.active);
  const items: TaskItem[] = activeTasks.map((task) => {
    const log = logByTask.get(task.id);
    return {
      id: task.id,
      title: task.title,
      category: task.category,
      target: Number(task.target ?? 0),
      unit: task.unit ?? 'check',
      completed: Boolean(log?.completed),
      value: Number(log?.value ?? 0),
      slug: task.template_id === null ? null : (slugById.get(task.template_id) ?? null),
    };
  });

  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');
  const phase = phaseForDay(day);

  // §8.7: recovery blends last night's sleep with yesterday's training load.
  const recovery = recoveryScore({
    sleepHours: sleep?.hours ?? null,
    sleepQuality: sleep?.quality ?? null,
    soreness: lastSession?.soreness ?? null,
    previousSessionRpe: lastSession?.session_rpe ?? null,
  });

  const sleepToday: SleepToday = {
    bedTime: sleep?.bed_time ? sleep.bed_time.slice(11, 16) : '23:00',
    wakeTime: sleep?.wake_time ? sleep.wake_time.slice(11, 16) : (profile.wake_time ?? '05:00').slice(0, 5),
    quality: sleep?.quality ?? null,
    hours: sleep?.hours ?? null,
  };

  const activeSlugs = new Set(items.map((item) => item.slug));
  const contentPosts: ContentPost[] = (posts ?? []).map((post) => ({
    id: post.id,
    platform: post.platform ?? 'other',
    title: post.title ?? 'Untitled',
    url: post.url,
    logDate: post.log_date,
  }));

  return (
    <div className="space-y-8">
      <DayHeader
        day={day}
        phase={phase}
        streak={stats.streak.current}
        progress={stats.today}
        points={stats.points.total}
        recovery={recovery.score}
      />

      <SleepCard today={sleepToday} recovery={recovery} />

      {items.length > 0 ? (
        <TaskList tasks={items} logDate={logDate} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No active tasks</CardTitle>
            <CardDescription>
              Every task is switched off. Turn some back on to start logging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/tasks" className={buttonVariants({ variant: 'outline' })}>
              Manage tasks
            </Link>
          </CardContent>
        </Card>
      )}

      {activeSlugs.has('gita') ? (
        <GitaTracker completed={(gita ?? []).map((row) => row.chapter)} />
      ) : null}

      {activeSlugs.has('content') ? (
        <ContentTracker posts={contentPosts} thisWeek={contentPosts.length} />
      ) : null}

      <FullDayCelebration full={stats.today.full} logDate={logDate} />
    </div>
  );
}
