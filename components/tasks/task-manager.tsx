'use client';

import { useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { parseDecimal } from '@/lib/decimal';
import {
  deleteCustomTask,
  setModule,
  setTaskActive,
  setTaskTarget,
} from '@/app/(app)/tasks/actions';

export interface ManagedTask {
  id: string;
  title: string;
  category: string;
  target: number;
  unit: string;
  active: boolean;
  isCustom: boolean;
}

export interface ManagedModule {
  slug: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Forced on by the current goal, so it cannot be switched off. */
  locked: boolean;
}

const CATEGORY_ORDER = ['discipline', 'body', 'face', 'mind', 'spirit', 'work'] as const;
const CATEGORY_LABELS: Record<string, string> = {
  discipline: 'Discipline',
  body: 'Body',
  face: 'Face',
  mind: 'Mind',
  spirit: 'Spirit',
  work: 'Work',
};

export function TaskManager({
  tasks,
  modules,
}: {
  tasks: ManagedTask[];
  modules: ManagedModule[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      setError(result.error ?? null);
    });

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: tasks.filter((t) => t.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="label-xs">Modules</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          {modules.map((module, index) => (
            <li
              key={module.slug}
              className={cn(
                'flex items-start gap-3 bg-card p-4',
                index > 0 && 'border-t border-border',
              )}
            >
              <input
                type="checkbox"
                id={`module-${module.slug}`}
                checked={module.enabled}
                disabled={module.locked}
                onChange={(event) =>
                  run(() => setModule({ module: module.slug, enabled: event.target.checked }))
                }
                className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-50"
              />
              <label htmlFor={`module-${module.slug}`} className="flex-1 cursor-pointer space-y-1">
                <span className="block text-sm font-medium">
                  {module.label}
                  {module.locked ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      required by your goal
                    </span>
                  ) : null}
                </span>
                <span className="block text-xs text-muted-foreground">{module.description}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      {grouped.map(({ category, items }) => (
        <section key={category} className="space-y-2">
          <h2 className="label-xs">{CATEGORY_LABELS[category] ?? category}</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {items.map((task, index) => (
              <li
                key={task.id}
                className={cn('bg-card p-4', index > 0 && 'border-t border-border')}
              >
                {/* Keyed on the server values so a reset or preset change
                    remounts the row with fresh local state. */}
                <TaskRow
                  key={`${task.id}:${task.target}:${task.active}`}
                  task={task}
                  onError={setError}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TaskRow({
  task,
  onError,
}: {
  task: ManagedTask;
  onError: (message: string | null) => void;
}) {
  const [target, setTarget] = useState(String(task.target));
  const [pending, startTransition] = useTransition();

  const call = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn();
      onError(result.error ?? null);
    });

  function commitTarget() {
    const next = parseDecimal(target);
    if (!Number.isFinite(next) || next <= 0 || next === task.target) {
      setTarget(String(task.target));
      return;
    }
    call(() => setTaskTarget({ taskId: task.id, target: next }));
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id={`task-${task.id}`}
        checked={task.active}
        onChange={(event) => call(() => setTaskActive({ taskId: task.id, active: event.target.checked }))}
        className="size-4 shrink-0 accent-primary"
        aria-label={`${task.title} active`}
      />

      <label
        htmlFor={`task-${task.id}`}
        className={cn(
          'flex-1 cursor-pointer text-sm',
          !task.active && 'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </label>

      {task.unit === 'check' ? (
        <span className="w-24 shrink-0 text-right font-mono text-xs text-muted-foreground">
          done / not
        </span>
      ) : (
        <span className="flex w-24 shrink-0 items-center gap-1">
          <DecimalInput
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            onBlur={commitTarget}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            aria-label={`${task.title} target`}
            className="h-8 px-2 text-right font-mono text-xs"
          />
          <span className="w-8 shrink-0 font-mono text-[0.65rem] text-muted-foreground">
            {task.unit}
          </span>
        </span>
      )}

      {pending ? <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" /> : null}

      {task.isCustom ? (
        <button
          type="button"
          onClick={() => call(() => deleteCustomTask({ taskId: task.id }))}
          aria-label={`Delete ${task.title}`}
          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function GoalPresetButton({
  summary,
  action,
}: {
  summary: string;
  action: () => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">{summary}</p>
      <p className="text-xs text-muted-foreground">
        Resets seeded targets and wording to your goal&apos;s defaults. Custom tasks are left alone.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await action();
            setError(result.error ?? null);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Reset to goal defaults
      </Button>
    </div>
  );
}
