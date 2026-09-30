import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/profile';
import { loadToday } from '@/lib/tasks/ensure';
import { loadDisciplineStats } from '@/lib/tasks/stats';
import { challengeDay, phaseForDay } from '@/lib/calc/day';
import { DayHeader } from '@/components/today/day-header';
import { FullDayCelebration } from '@/components/today/full-day';
import { TaskList, type TaskItem } from '@/components/today/task-list';
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

  const logByTask = new Map(logs.map((log) => [log.user_task_id, log]));

  const items: TaskItem[] = tasks
    .filter((task) => task.active)
    .map((task) => {
      const log = logByTask.get(task.id);
      return {
        id: task.id,
        title: task.title,
        category: task.category,
        target: Number(task.target ?? 0),
        unit: task.unit ?? 'check',
        completed: Boolean(log?.completed),
        value: Number(log?.value ?? 0),
      };
    });

  const day = challengeDay(profile.challenge_start, profile.timezone ?? '');
  const phase = phaseForDay(day);

  return (
    <div className="space-y-8">
      <DayHeader
        day={day}
        phase={phase}
        streak={stats.streak.current}
        progress={stats.today}
        points={stats.points.total}
      />

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

      <FullDayCelebration full={stats.today.full} logDate={logDate} />
    </div>
  );
}
