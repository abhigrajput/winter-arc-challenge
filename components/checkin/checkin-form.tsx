'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface CheckinResponse {
  source: 'ai' | 'rules';
  week: number;
  feedback: {
    verdict: string;
    changes: string[];
    swaps: { from: string; to: string; why: string }[];
    notes: string[];
  };
  calorieAdjustment: number;
  newCalorieTarget: number;
  autoAdjustReason: string;
}

const SCALE = [1, 2, 3, 4, 5];

/** §8.9 weekly check-in form and result. */
export function CheckinForm({ week, alreadyDone }: { week: number; alreadyDone: boolean }) {
  const [energy, setEnergy] = useState<number | null>(null);
  const [hunger, setHunger] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [painNotes, setPainNotes] = useState('');
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (alreadyDone && !result) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        You have already checked in for week {week}. The next one opens next week.
      </p>
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch('/api/ai/checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ energy, hunger, notes, painNotes }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setError(body?.error ?? 'Could not submit the check-in.');
        return;
      }
      setResult(body);
    });
  }

  if (result) return <CheckinResult result={result} />;

  return (
    <div className="space-y-6">
      <Scale label="Energy this week" value={energy} onChange={setEnergy} low="Flat" high="Strong" />
      <Scale label="Hunger this week" value={hunger} onChange={setHunger} low="Low" high="Ravenous" />

      <div className="space-y-2">
        <Label htmlFor="painNotes">Any pain or niggles?</Label>
        <textarea
          id="painNotes"
          value={painNotes}
          onChange={(e) => setPainNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Left shoulder on pressing. Leave blank if nothing."
          className="w-full rounded-md border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-[0.65rem] text-muted-foreground">
          Anything here changes next week&apos;s plan, and the review will tell you to get it
          looked at.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Anything else</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Travel, exams, bad sleep, whatever shaped the week."
          className="w-full rounded-md border border-input bg-card p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending} size="lg" className="w-full">
        {pending ? <Loader2 className="animate-spin" /> : null}
        Submit week {week} check-in
      </Button>
    </div>
  );
}

function CheckinResult({ result }: { result: CheckinResponse }) {
  const { feedback, calorieAdjustment, newCalorieTarget } = result;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Week {result.week}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">{feedback.verdict}</p>
          {result.source === 'rules' ? (
            <p className="text-xs text-muted-foreground">
              Written from your numbers — the coach was unavailable, so this is the rules-based
              review.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {calorieAdjustment === 0 ? null : calorieAdjustment > 0 ? (
              <TrendingUp className="size-4 text-primary" aria-hidden />
            ) : (
              <TrendingDown className="size-4 text-primary" aria-hidden />
            )}
            Calories
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-2xl">
            {newCalorieTarget}
            {calorieAdjustment !== 0 ? (
              <span className="ml-2 text-sm text-muted-foreground">
                ({calorieAdjustment > 0 ? '+' : ''}
                {calorieAdjustment})
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{result.autoAdjustReason}</p>
        </CardContent>
      </Card>

      <section className="space-y-2">
        <h2 className="label-xs">Next week</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          {feedback.changes.map((change, index) => (
            <li
              key={change}
              className={cn('flex gap-3 bg-card p-4', index > 0 && 'border-t border-border')}
            >
              <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
              <span className="text-sm">{change}</span>
            </li>
          ))}
        </ul>
      </section>

      {feedback.swaps.length > 0 ? (
        <section className="space-y-2">
          <h2 className="label-xs">Exercise swaps</h2>
          <ul className="overflow-hidden rounded-lg border border-border">
            {feedback.swaps.map((swap, index) => (
              <li
                key={`${swap.from}-${index}`}
                className={cn('bg-card p-4', index > 0 && 'border-t border-border')}
              >
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground line-through">{swap.from}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
                  {swap.to}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{swap.why}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feedback.notes.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {feedback.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Scale({
  label,
  value,
  onChange,
  low,
  high,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  low: string;
  high: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="label-xs">{label}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {SCALE.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-md border py-2.5 font-mono text-sm transition-colors',
              value === option
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input hover:bg-accent',
            )}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[0.65rem] text-muted-foreground">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
