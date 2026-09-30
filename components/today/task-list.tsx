'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { setTaskValue, toggleTask } from '@/app/(app)/today/actions';

export interface TaskItem {
  id: string;
  title: string;
  category: string;
  target: number;
  unit: string;
  completed: boolean;
  value: number;
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

/** How much one tap adds, per unit. */
const STEP: Record<string, number> = {
  steps: 1000,
  min: 5,
  rounds: 1,
  km: 0.5,
  L: 0.25,
};

export function TaskList({ tasks, logDate }: { tasks: TaskItem[]; logDate: string }) {
  const [optimisticTasks, applyOptimistic] = useOptimistic(
    tasks,
    (state: TaskItem[], update: { id: string; completed: boolean; value: number }) =>
      state.map((task) =>
        task.id === update.id
          ? { ...task, completed: update.completed, value: update.value }
          : task,
      ),
  );

  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: optimisticTasks.filter((task) => task.category === category),
  })).filter((group) => group.items.length > 0);

  function runToggle(task: TaskItem) {
    const completed = !task.completed;
    startTransition(async () => {
      applyOptimistic({ id: task.id, completed, value: completed ? task.target : 0 });
      const result = await toggleTask({ taskId: task.id, logDate, completed });
      setError(result.error ?? null);
    });
  }

  function runValue(task: TaskItem, value: number) {
    const next = Math.max(0, Math.round(value * 100) / 100);
    startTransition(async () => {
      applyOptimistic({ id: task.id, completed: next >= task.target, value: next });
      const result = await setTaskValue({ taskId: task.id, logDate, value: next });
      setError(result.error ?? null);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {grouped.map(({ category, items }) => (
        <section key={category} className="space-y-2">
          <h2 className="label-xs">{CATEGORY_LABELS[category] ?? category}</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {items.map((task, index) => (
              <li
                key={task.id}
                className={cn('bg-card', index > 0 && 'border-t border-border')}
              >
                {task.unit === 'check' ? (
                  <CheckRow task={task} onToggle={() => runToggle(task)} />
                ) : (
                  <NumericRow
                    task={task}
                    onSet={(value) => runValue(task, value)}
                    onToggle={() => runToggle(task)}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CheckRow({ task, onToggle }: { task: TaskItem; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={task.completed}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-accent"
    >
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
          task.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
        )}
      >
        {task.completed ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span
        className={cn(
          'text-sm transition-colors',
          task.completed && 'text-muted-foreground line-through',
        )}
      >
        {task.title}
      </span>
    </button>
  );
}

function NumericRow({
  task,
  onSet,
  onToggle,
}: {
  task: TaskItem;
  onSet: (value: number) => void;
  onToggle: () => void;
}) {
  const step = STEP[task.unit] ?? 1;
  const percent = task.target > 0 ? Math.min(100, (task.value / task.target) * 100) : 0;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={task.completed}
          aria-label={task.completed ? `Clear ${task.title}` : `Complete ${task.title}`}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
            task.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
          )}
        >
          {task.completed ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </button>

        <span className="flex-1 text-sm">{task.title}</span>

        <span className="font-mono text-xs text-muted-foreground">
          {formatValue(task.value)}/{formatValue(task.target)} {task.unit}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${task.title} progress`}
        >
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex shrink-0 gap-1">
          <StepButton
            label={`Subtract ${step} ${task.unit}`}
            onClick={() => onSet(task.value - step)}
            disabled={task.value <= 0}
          >
            <Minus className="size-3.5" />
          </StepButton>
          <StepButton label={`Add ${step} ${task.unit}`} onClick={() => onSet(task.value + step)}>
            <Plus className="size-3.5" />
          </StepButton>
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded border border-input transition-colors hover:bg-accent disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
