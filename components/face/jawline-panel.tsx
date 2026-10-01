'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JAWLINE_DRILLS } from '@/lib/face/routine';
import { setJawlineDrillsDone } from '@/app/(app)/face/actions';

/** §8.4: the drills, with the task tick attached. */
export function JawlineDrills({ done }: { done: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="overflow-hidden rounded-lg border border-border">
        {JAWLINE_DRILLS.map((drill, index) => (
          <li
            key={drill.slug}
            className={cn('bg-card p-4', index > 0 && 'border-t border-border')}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{drill.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {drill.dose}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{drill.cue}</p>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        aria-pressed={done}
        onClick={() =>
          startTransition(async () => {
            const result = await setJawlineDrillsDone({ done: !done });
            setError(result.error ?? null);
          })
        }
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-md border py-3 text-sm transition-colors',
          done
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-input hover:bg-accent',
        )}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : done ? (
          <Check className="size-4" />
        ) : null}
        {done ? 'Done today' : 'Mark drills done'}
      </button>
    </div>
  );
}
