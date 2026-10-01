'use client';

import { useEffect, useState, useTransition } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExerciseLogger, type LoggerExercise } from '@/components/train/exercise-logger';
import { RestTimer } from '@/components/train/rest-timer';
import { finishSession } from '@/app/(app)/train/actions';

export function SessionLogger({
  sessionId,
  dayName,
  startedAt,
  exercises,
}: {
  sessionId: string;
  dayName: string;
  startedAt: string | null;
  exercises: LoggerExercise[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();

  const loggedSets = exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((s) => (s.reps ?? 0) > 0).length,
    0,
  );

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <p className="label-xs">In progress</p>
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">{dayName}</h1>
          <Elapsed startedAt={startedAt} />
        </div>
        <p className="font-mono text-xs text-muted-foreground">{loggedSets} sets logged</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {exercises.map((exercise) => (
          <ExerciseLogger
            key={exercise.id}
            sessionId={sessionId}
            exercise={exercise}
            onError={setError}
          />
        ))}
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="label-xs">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Felt strong. Left shoulder a bit tight."
          className="w-full rounded-md border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending || loggedSets === 0}
        onClick={() =>
          startTransition(async () => {
            const result = await finishSession({ sessionId, notes });
            setError(result.error ?? null);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        {loggedSets === 0 ? 'Log a set to finish' : 'Finish session'}
      </Button>

      <RestTimer />
    </div>
  );
}

/** Ticks up from started_at. Client-only so the server render stays stable. */
function Elapsed({ startedAt }: { startedAt: string | null }) {
  const [label, setLabel] = useState('--:--');

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();

    const update = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const minutes = Math.floor(seconds / 60);
      setLabel(`${minutes}:${String(seconds % 60).padStart(2, '0')}`);
    };

    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  return <span className="font-mono text-sm text-muted-foreground tabular-nums">{label}</span>;
}
