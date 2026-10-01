'use client';

import { useActionState } from 'react';
import { Loader2, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveSleepLog, type MindResult } from '@/app/(app)/today/mind-actions';

export interface SleepToday {
  bedTime: string;
  wakeTime: string;
  quality: number | null;
  hours: number | null;
}

export interface RecoveryView {
  score: number | null;
  band: 'low' | 'moderate' | 'good' | 'unknown';
  advice: string;
}

const QUALITY_LABELS = ['Awful', 'Poor', 'OK', 'Good', 'Great'];

/** §8.7: sleep log plus the recovery score it feeds. */
export function SleepCard({ today, recovery }: { today: SleepToday; recovery: RecoveryView }) {
  const [state, action, pending] = useActionState<MindResult, FormData>(saveSleepLog, {});

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="label-xs flex items-center gap-1.5">
          <Moon className="size-3.5" aria-hidden />
          Last night
        </h2>
        {recovery.score !== null ? (
          <span
            className={cn(
              'shrink-0 rounded-md border px-2 py-1 font-mono text-xs',
              recovery.band === 'low'
                ? 'border-destructive/50 text-destructive'
                : recovery.band === 'good'
                  ? 'border-primary/50 text-primary'
                  : 'border-border text-muted-foreground',
            )}
          >
            {recovery.score} recovery
          </span>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{recovery.advice}</p>

      <form action={action} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bedTime">Bed</Label>
            <Input id="bedTime" name="bedTime" type="time" defaultValue={today.bedTime} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wakeTime">Wake</Label>
            <Input id="wakeTime" name="wakeTime" type="time" defaultValue={today.wakeTime} required />
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="label-xs">Quality</legend>
          <div className="grid grid-cols-5 gap-1.5">
            {QUALITY_LABELS.map((label, index) => {
              const value = index + 1;
              return (
                <label
                  key={value}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-0.5 rounded-md border py-2 transition-colors',
                    'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary',
                    'border-input hover:bg-accent',
                  )}
                >
                  <input
                    type="radio"
                    name="quality"
                    value={value}
                    defaultChecked={today.quality === value}
                    required
                    className="sr-only"
                  />
                  <span className="font-mono text-sm">{value}</span>
                  <span className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {state.error ? (
          <p role="alert" className="text-xs text-destructive">
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save sleep
          </Button>
          {today.hours !== null ? (
            <span className="font-mono text-xs text-muted-foreground">{today.hours} h</span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
