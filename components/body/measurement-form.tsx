'use client';

import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DecimalInput } from '@/components/ui/decimal-input';
import { Label } from '@/components/ui/label';
import { saveMeasurements, type BodyResult } from '@/app/(app)/body/actions';

export interface MeasurementValues {
  weight_kg: string;
  waist_cm: string;
  chest_cm: string;
  arm_cm: string;
  thigh_cm: string;
  neck_cm: string;
  hip_cm: string;
}

const FIELDS: { name: keyof MeasurementValues; label: string; hint?: string }[] = [
  { name: 'waist_cm', label: 'Waist (cm)', hint: 'At the navel, relaxed' },
  { name: 'chest_cm', label: 'Chest (cm)' },
  { name: 'arm_cm', label: 'Arm (cm)', hint: 'Flexed, biggest point' },
  { name: 'thigh_cm', label: 'Thigh (cm)' },
  { name: 'neck_cm', label: 'Neck (cm)', hint: 'Below the larynx' },
];

export function MeasurementForm({
  current,
  needsHip,
}: {
  current: MeasurementValues;
  needsHip: boolean;
}) {
  const [state, action, pending] = useActionState<BodyResult, FormData>(saveMeasurements, {});

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="weight_kg">Weight (kg)</Label>
        <DecimalInput
          id="weight_kg"
          name="weight_kg"
          defaultValue={current.weight_kg}
          placeholder="Optional, but daily is best"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>{field.label}</Label>
            <DecimalInput
              id={field.name}
              name={field.name}
              defaultValue={current[field.name]}
            />
            {field.hint ? (
              <p className="text-[0.65rem] text-muted-foreground">{field.hint}</p>
            ) : null}
          </div>
        ))}

        {needsHip ? (
          <div className="space-y-2">
            <Label htmlFor="hip_cm">Hip (cm)</Label>
            <DecimalInput
              id="hip_cm"
              name="hip_cm"
              defaultValue={current.hip_cm}
            />
            <p className="text-[0.65rem] text-muted-foreground">Widest point</p>
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Save
      </Button>

      <p className="text-[0.65rem] text-muted-foreground">
        Weekly is enough for the tape. Blank fields keep whatever is already saved for today.
      </p>
    </form>
  );
}
