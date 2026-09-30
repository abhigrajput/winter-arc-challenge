'use client';

import { useActionState, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addCustomTask, type TaskResult } from '@/app/(app)/tasks/actions';

const CATEGORIES = [
  ['discipline', 'Discipline'],
  ['body', 'Body'],
  ['face', 'Face'],
  ['mind', 'Mind'],
  ['spirit', 'Spirit'],
  ['work', 'Work'],
] as const;

const UNITS = [
  ['check', 'Done / not done'],
  ['min', 'Minutes'],
  ['rounds', 'Rounds'],
  ['steps', 'Steps'],
  ['km', 'Kilometres'],
  ['L', 'Litres'],
] as const;

const selectClass =
  'flex h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export function AddTask() {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState('check');
  const [state, action, pending] = useActionState<TaskResult, FormData>(addCustomTask, {});

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus />
        Add a task
      </Button>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="title">Task</Label>
        <Input id="title" name="title" placeholder="Cold shower" required maxLength={60} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="category">Group</Label>
          <select id="category" name="category" defaultValue="discipline" className={selectClass}>
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit">Measured in</Label>
          <select
            id="unit"
            name="unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            className={selectClass}
          >
            {UNITS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* A check task is just a target of 1. */}
      {unit === 'check' ? (
        <input type="hidden" name="target" value="1" />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="target">Daily target</Label>
          <Input
            id="target"
            name="target"
            type="number"
            step="any"
            min="0.01"
            inputMode="decimal"
            defaultValue="1"
            required
          />
        </div>
      )}

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="animate-spin" /> : null}
          Add
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
