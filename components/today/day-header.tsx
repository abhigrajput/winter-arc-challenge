import { Flame, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Phase } from '@/lib/calc/day';
import { CHALLENGE_DAYS } from '@/lib/calc/day';
import type { TodayProgress } from '@/lib/calc/points';

/** §8.10 header: Day X/90, phase, streak, today %. */
export function DayHeader({
  day,
  phase,
  streak,
  progress,
  points,
  recovery,
}: {
  day: number;
  phase: Phase;
  streak: number;
  progress: TodayProgress;
  points: number;
  /** §8.10: recovery score, null until sleep is logged. */
  recovery: number | null;
}) {
  return (
    <header className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="label-xs">
            Day {day} / {CHALLENGE_DAYS}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {phase.name}
            {phase.deload ? <span className="text-muted-foreground"> · deload</span> : null}
          </h1>
          <p className="text-xs text-muted-foreground">
            Week {phase.week} · {phase.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {recovery !== null ? (
            <div
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5"
              title="Recovery score"
            >
              <HeartPulse
                className={cn(
                  'size-4',
                  recovery < 50 ? 'text-destructive' : recovery >= 75 ? 'text-primary' : 'text-muted-foreground',
                )}
                aria-hidden
              />
              <span className="font-mono text-sm">{recovery}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5">
            <Flame
              className={cn('size-4', streak > 0 ? 'text-primary' : 'text-muted-foreground')}
              aria-hidden
            />
            <span className="font-mono text-sm">{streak}</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-mono">
            {progress.completed}/{progress.active} done · {progress.percent}%
          </span>
          <span className="font-mono text-muted-foreground">{points} pts</span>
        </div>

        <div
          className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's completion"
        >
          <div
            className={cn(
              'h-full transition-all duration-500',
              progress.full ? 'bg-primary' : progress.streakSafe ? 'bg-primary/70' : 'bg-primary/40',
            )}
            style={{ width: `${progress.percent}%` }}
          />
          {/* The 80% streak bar. */}
          <span
            aria-hidden
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: '80%' }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {progress.active === 0
            ? 'No active tasks. Turn some on from Tasks.'
            : progress.full
              ? 'Every task done.'
              : progress.streakSafe
                ? 'Streak day banked.'
                : `${progress.tasksToStreak} more to bank the day.`}
        </p>
      </div>
    </header>
  );
}
