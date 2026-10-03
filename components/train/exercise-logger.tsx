'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Info, Loader2, Repeat, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimal } from '@/lib/decimal';
import { deleteSet, logSet, swapExercise } from '@/app/(app)/train/actions';

export interface LoggerSet {
  setNo: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  isPr: boolean;
}

export interface LoggerExercise {
  id: number;
  name: string;
  muscleGroup: string;
  isBodyweight: boolean;
  cues: string[];
  mistakes: string[];
  plannedSets: number;
  repLow: number;
  repTop: number;
  previous: { bestReps: number; best1RM: number; lastWeightKg: number | null; lastReps: number | null } | null;
  sets: LoggerSet[];
  /** Same muscle group, equipment the user owns. */
  alternatives: { id: number; name: string }[];
}

export function ExerciseLogger({
  sessionId,
  exercise,
  onError,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  onError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      onError(result.error ?? null);
    });

  const rows = Array.from({ length: Math.max(exercise.plannedSets, exercise.sets.length) }, (_, i) => {
    const setNo = i + 1;
    return exercise.sets.find((s) => s.setNo === setNo) ?? { setNo, reps: null, weightKg: null, rpe: null, isPr: false };
  });

  const logged = exercise.sets.filter((s) => (s.reps ?? 0) > 0).length;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{exercise.name}</h2>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {exercise.plannedSets} x {exercise.repLow}-{exercise.repTop}
            {logged > 0 ? ` · ${logged} logged` : ''}
          </p>
          {exercise.previous ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Last:{' '}
              {exercise.isBodyweight
                ? `${exercise.previous.bestReps} reps best`
                : exercise.previous.lastWeightKg
                  ? `${exercise.previous.lastWeightKg} kg x ${exercise.previous.lastReps ?? '-'}`
                  : 'bodyweight'}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">First time logging this.</p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <IconButton label="Form cues" onClick={() => setOpen((v) => !v)} active={open}>
            <Info className="size-4" />
          </IconButton>
          {exercise.alternatives.length > 0 ? (
            <IconButton label="Swap exercise" onClick={() => setShowSwap((v) => !v)} active={showSwap}>
              <Repeat className="size-4" />
            </IconButton>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-border bg-background/40 p-4 text-xs">
          <div>
            <p className="label-xs">Cues</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {exercise.cues.map((cue) => (
                <li key={cue}>· {cue}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label-xs">Common mistakes</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {exercise.mistakes.map((mistake) => (
                <li key={mistake}>· {mistake}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {showSwap ? (
        <div className="border-t border-border bg-background/40 p-4">
          <p className="label-xs mb-2">Swap for</p>
          <div className="flex flex-wrap gap-2">
            {exercise.alternatives.map((alt) => (
              <button
                key={alt.id}
                type="button"
                onClick={() =>
                  call(() =>
                    swapExercise({
                      sessionId,
                      fromExerciseId: exercise.id,
                      toExerciseId: alt.id,
                    }),
                  )
                }
                className="rounded-md border border-input px-3 py-1.5 text-xs transition-colors hover:bg-accent"
              >
                {alt.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border">
        <div className="grid grid-cols-[2rem_1fr_1fr_3rem_2rem] items-center gap-2 px-4 py-2 text-[0.65rem] uppercase tracking-wider text-muted-foreground">
          <span>Set</span>
          <span>{exercise.isBodyweight ? 'Reps' : 'Kg'}</span>
          <span>{exercise.isBodyweight ? '' : 'Reps'}</span>
          <span>RPE</span>
          <span />
        </div>

        {rows.map((row) => (
          <SetRow
            key={row.setNo}
            sessionId={sessionId}
            exercise={exercise}
            row={row}
            call={call}
          />
        ))}
      </div>

      {pending ? (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Saving
        </div>
      ) : null}
    </section>
  );
}

function SetRow({
  sessionId,
  exercise,
  row,
  call,
}: {
  sessionId: string;
  exercise: LoggerExercise;
  row: LoggerSet;
  call: (fn: () => Promise<{ error?: string }>) => void;
}) {
  const [weight, setWeight] = useState(row.weightKg === null ? '' : String(row.weightKg));
  const [reps, setReps] = useState(row.reps === null ? '' : String(row.reps));
  const [rpe, setRpe] = useState(row.rpe === null ? '' : String(row.rpe));

  function save() {
    const repsValue = reps.trim() === '' ? null : parseDecimal(reps);
    if (repsValue === null || !Number.isFinite(repsValue)) return;

    call(() =>
      logSet({
        sessionId,
        exerciseId: exercise.id,
        setNo: row.setNo,
        reps: Math.round(repsValue),
        weightKg: weight.trim() === '' ? null : parseDecimal(weight),
        durationSec: null,
        rpe: rpe.trim() === '' ? null : parseDecimal(rpe),
      }),
    );
  }

  const filled = (row.reps ?? 0) > 0;

  return (
    <div
      className={cn(
        'grid grid-cols-[2rem_1fr_1fr_3rem_2rem] items-center gap-2 border-t border-border px-4 py-2',
        filled && 'bg-primary/5',
      )}
    >
      <span className="font-mono text-xs text-muted-foreground">
        {row.setNo}
        {row.isPr ? <span className="ml-1 text-primary">PR</span> : null}
      </span>

      {exercise.isBodyweight ? (
        <>
          <DecimalInput
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={save}
            integer
            placeholder="reps"
            aria-label={`${exercise.name} set ${row.setNo} reps`}
            className="h-9 px-2 text-center font-mono text-sm"
          />
          <span />
        </>
      ) : (
        <>
          <DecimalInput
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={save}
            placeholder="kg"
            aria-label={`${exercise.name} set ${row.setNo} weight`}
            className="h-9 px-2 text-center font-mono text-sm"
          />
          <DecimalInput
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            onBlur={save}
            integer
            placeholder="reps"
            aria-label={`${exercise.name} set ${row.setNo} reps`}
            className="h-9 px-2 text-center font-mono text-sm"
          />
        </>
      )}

      <DecimalInput
        value={rpe}
        onChange={(e) => setRpe(e.target.value)}
        onBlur={save}
        placeholder="-"
        aria-label={`${exercise.name} set ${row.setNo} RPE`}
        className="h-9 px-1 text-center font-mono text-xs"
      />

      {filled ? (
        <button
          type="button"
          onClick={() =>
            call(() => deleteSet({ sessionId, exerciseId: exercise.id, setNo: row.setNo }))
          }
          aria-label={`Clear set ${row.setNo}`}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      className={cn(
        'rounded-md border border-input p-2 transition-colors hover:bg-accent',
        active && 'border-primary text-primary',
      )}
    >
      {children}
      <ChevronDown className="sr-only" />
    </button>
  );
}
