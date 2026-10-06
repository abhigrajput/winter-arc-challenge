import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { PhaseName } from '@/lib/calc/day';

/**
 * Markup shared by the server placeholder and the animated day counter, so
 * swapping one for the other causes no layout shift.
 */

export const PHASES: { name: PhaseName; days: string; copy: string }[] = [
  { name: 'Foundation', days: '1–28', copy: 'Technique and habits. Week 4 deload.' },
  { name: 'Build', days: '29–56', copy: 'Volume up. Aggressive progression.' },
  { name: 'Peak', days: '57–84', copy: 'Highest intensity. Tighter diet.' },
  { name: 'Test', days: '85–90', copy: 'Rep-max tests. Final photos. Before/after.' },
];

export function DayCounterLayout({ day, phase }: { day: ReactNode; phase: PhaseName }) {
  return (
    <>
      <p className="font-mono text-7xl font-semibold tabular-nums sm:text-8xl" aria-label="Day 1 to day 90">
        <span className="text-muted-foreground">Day </span>
        <span className="text-primary" data-testid="day-counter">
          {day}
        </span>
      </p>

      <ol className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {PHASES.map((p) => (
          <li
            key={p.name}
            data-active={phase === p.name}
            className={cn(
              'rounded-lg border bg-card/60 p-4 transition-colors duration-500',
              phase === p.name ? 'border-primary/60 bg-primary/10' : 'border-border',
            )}
          >
            <p className="flex items-baseline justify-between gap-2">
              <span className={cn('text-sm font-semibold', phase === p.name && 'text-primary')}>{p.name}</span>
              <span className="font-mono text-[0.65rem] text-muted-foreground">{p.days}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{p.copy}</p>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Server-rendered placeholder until the animated counter loads. */
export function DayCounterStatic() {
  return (
    <div className="mt-12 flex flex-col items-center gap-10">
      <DayCounterLayout day="1" phase="Foundation" />
    </div>
  );
}
