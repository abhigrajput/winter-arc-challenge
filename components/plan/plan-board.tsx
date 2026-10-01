'use client';

import { useState, useTransition } from 'react';
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PlanType } from '@/lib/ai/schemas';
import { PlanView } from '@/components/plan/plan-view';

export interface StoredPlan {
  plan: unknown;
  source: 'ai' | 'template';
  createdAt: string | null;
}

const TABS: { type: PlanType; label: string; blurb: string }[] = [
  { type: 'workout', label: 'Training', blurb: 'A week of sessions for your split and equipment.' },
  { type: 'diet', label: 'Diet', blurb: 'Meals that hit your calorie and protein targets.' },
  { type: 'skincare', label: 'Skin', blurb: 'A simple over-the-counter routine.' },
];

export function PlanBoard({
  week,
  plans,
  remaining,
}: {
  week: number;
  plans: Partial<Record<PlanType, StoredPlan>>;
  remaining: Record<PlanType, number>;
}) {
  const [active, setActive] = useState<PlanType>('workout');
  const [local, setLocal] = useState(plans);
  const [notice, setNotice] = useState<string | null>(null);
  const [violations, setViolations] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const current = local[active];
  const tab = TABS.find((t) => t.type === active)!;
  const left = remaining[active] ?? 0;

  function generate() {
    setNotice(null);
    setViolations([]);

    startTransition(async () => {
      const response = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: active, week }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        setNotice(body?.error ?? 'Could not generate a plan. Try again.');
        return;
      }

      setLocal((prev) => ({
        ...prev,
        [active]: { plan: body.plan, source: body.source, createdAt: new Date().toISOString() },
      }));

      if (body.source === 'template') {
        setNotice(body.reason ?? 'Showing the template plan.');
        setViolations(Array.isArray(body.violations) ? body.violations : []);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div
        role="tablist"
        aria-label="Plan type"
        className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border"
      >
        {TABS.map((item) => (
          <button
            key={item.type}
            role="tab"
            aria-selected={active === item.type}
            onClick={() => {
              setActive(item.type);
              setNotice(null);
              setViolations([]);
            }}
            className={cn(
              'bg-card py-3 text-xs font-medium uppercase tracking-wider transition-colors',
              active === item.type ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">{tab.blurb}</p>

      {notice ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            {notice}
          </p>
          {violations.length > 0 ? (
            <ul className="space-y-0.5 pl-6 text-xs text-muted-foreground">
              {violations.map((reason) => (
                <li key={reason}>· {reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {current ? (
        <div className="space-y-3">
          <p className="label-xs">
            {current.source === 'ai' ? 'Generated' : 'Template'}
            {current.createdAt ? ` · ${current.createdAt.slice(0, 10)}` : ''}
          </p>
          <PlanView type={active} plan={current.plan} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No {tab.label.toLowerCase()} plan for week {week} yet.
        </p>
      )}

      <div className="space-y-2">
        <Button onClick={generate} disabled={pending || left <= 0} size="lg" className="w-full">
          {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {current ? 'Regenerate' : 'Generate'} {tab.label.toLowerCase()} plan
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {left > 0 ? `${left} left this week` : 'No generations left this week'}
        </p>
      </div>
    </div>
  );
}
