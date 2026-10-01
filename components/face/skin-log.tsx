'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { saveSkinLog } from '@/app/(app)/face/actions';

export interface SkinToday {
  amDone: boolean;
  pmDone: boolean;
  breakouts: number | null;
  dairy: boolean | null;
  notes: string;
}

const SCORE_LABELS = ['Clear', 'Barely', 'A few', 'Noticeable', 'Bad', 'Worst'];

export function SkinLog({ today }: { today: SkinToday }) {
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(today.notes);
  const [, startTransition] = useTransition();

  const run = (patch: Record<string, unknown>) =>
    startTransition(async () => {
      const result = await saveSkinLog(patch);
      setError(result.error ?? null);
    });

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <RoutineToggle
          label="Morning"
          icon={<Sun className="size-4" aria-hidden />}
          done={today.amDone}
          onToggle={() => run({ amDone: !today.amDone })}
        />
        <RoutineToggle
          label="Evening"
          icon={<Moon className="size-4" aria-hidden />}
          done={today.pmDone}
          onToggle={() => run({ pmDone: !today.pmDone })}
        />
      </div>

      <section className="space-y-2">
        <h3 className="label-xs">Breakouts today</h3>
        <div className="grid grid-cols-6 gap-1.5">
          {SCORE_LABELS.map((label, score) => (
            <button
              key={score}
              type="button"
              aria-pressed={today.breakouts === score}
              onClick={() => run({ breakouts: today.breakouts === score ? null : score })}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-md border py-2 transition-colors',
                today.breakouts === score
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:bg-accent',
              )}
            >
              <span className="font-mono text-sm">{score}</span>
              <span className="text-[0.55rem] uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="label-xs">Dairy today</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: true, label: 'Had dairy' },
            { value: false, label: 'None' },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={today.dairy === option.value}
              onClick={() => run({ dairy: today.dairy === option.value ? null : option.value })}
              className={cn(
                'rounded-md border py-2.5 text-xs transition-colors',
                today.dairy === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input hover:bg-accent',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[0.65rem] text-muted-foreground">
          Only tracked so you can see whether it lines up with anything. It is not a rule.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="label-xs">Notes</h3>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={() => {
            if (notes !== today.notes) run({ notes });
          }}
          rows={2}
          maxLength={500}
          placeholder="New product, stressful week, anything worth remembering."
          className="w-full rounded-md border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </section>
    </div>
  );
}

function RoutineToggle({
  label,
  icon,
  done,
  onToggle,
}: {
  label: string;
  icon: React.ReactNode;
  done: boolean;
  onToggle: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => startTransition(onToggle)}
      className={cn(
        'flex items-center justify-between rounded-lg border p-4 transition-colors',
        done ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-accent',
      )}
    >
      <span className="flex items-center gap-2 text-sm">
        {icon}
        {label}
      </span>
      {pending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <span
          className={cn(
            'flex size-5 items-center justify-center rounded border',
            done ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
          )}
        >
          {done ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
      )}
    </button>
  );
}
