'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { STREAK_RISK_TIME, WATER_SLOTS, type ReminderSettings } from '@/lib/reminders/settings';
import { saveReminderSettings, type ReminderSettingsState } from '@/app/(app)/settings/actions';

const ROWS: { kind: keyof ReminderSettings; label: string; note?: string; timed: boolean }[] = [
  { kind: 'wake', label: 'Wake up', timed: true },
  { kind: 'workout', label: 'Workout', note: 'Skipped once the workout is logged.', timed: true },
  {
    kind: 'water',
    label: 'Water',
    note: `Every 2 h, ${WATER_SLOTS[0]}–${WATER_SLOTS[WATER_SLOTS.length - 1]}. Stops once the water task is done.`,
    timed: false,
  },
  { kind: 'skincare_pm', label: 'Skincare PM', note: 'Skipped once ticked.', timed: true },
  { kind: 'wind_down', label: 'Sleep wind-down', timed: true },
  {
    kind: 'streak_risk',
    label: 'Streak at risk',
    note: `${STREAK_RISK_TIME}, only if under half of today is done.`,
    timed: false,
  },
];

export function ReminderForm({ settings }: { settings: ReminderSettings }) {
  const [state, action, pending] = useActionState<ReminderSettingsState, FormData>(saveReminderSettings, {});

  return (
    <form action={action} className="space-y-4">
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {ROWS.map((row) => {
          const setting = settings[row.kind];
          return (
            <li key={row.kind} className="flex items-center gap-3 px-4 py-3">
              <input
                type="checkbox"
                id={`${row.kind}_enabled`}
                name={`${row.kind}_enabled`}
                defaultChecked={setting.enabled}
                className="size-5 shrink-0 accent-primary"
              />
              <label htmlFor={`${row.kind}_enabled`} className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{row.label}</span>
                {row.note ? <span className="block text-xs text-muted-foreground">{row.note}</span> : null}
              </label>
              {row.timed && 'time' in setting ? (
                <Input
                  type="time"
                  name={`${row.kind}_time`}
                  defaultValue={setting.time}
                  step={900}
                  required
                  aria-label={`${row.label} time`}
                  className="h-9 w-28 shrink-0 px-2 font-mono text-sm"
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.saved ? (
        <p role="status" className="text-sm text-primary">
          Saved.
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full" size="lg">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save reminders
      </Button>
    </form>
  );
}
