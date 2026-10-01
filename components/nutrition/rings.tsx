import { cn } from '@/lib/utils';
import type { Ring } from '@/lib/calc/nutrition';

/** §8.5 rings: calories, protein, water. */
export function NutritionRings({
  calories,
  protein,
  water,
  overCalories,
}: {
  calories: Ring;
  protein: Ring;
  water: Ring;
  overCalories: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <RingDial
        label="Calories"
        ring={calories}
        unit="kcal"
        tone={overCalories ? 'warn' : 'default'}
      />
      <RingDial label="Protein" ring={protein} unit="g" />
      <RingDial label="Water" ring={water} unit="ml" format={(v) => `${Math.round(v / 100) / 10}L`} />
    </div>
  );
}

function RingDial({
  label,
  ring,
  unit,
  tone = 'default',
  format,
}: {
  label: string;
  ring: Ring;
  unit: string;
  tone?: 'default' | 'warn';
  format?: (value: number) => string;
}) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const dash = (ring.percent / 100) * circumference;

  const stroke = tone === 'warn' ? 'stroke-destructive' : ring.hit ? 'stroke-primary' : 'stroke-primary/70';

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-3">
      <svg viewBox="0 0 80 80" className="size-20 -rotate-90" role="img" aria-label={`${label}: ${ring.percent}%`}>
        <circle cx="40" cy="40" r={radius} className="fill-none stroke-muted" strokeWidth="7" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={cn('fill-none transition-all duration-500', stroke)}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>

      <p className="label-xs">{label}</p>
      <p className="font-mono text-sm">
        {format ? format(ring.consumed) : ring.consumed}
        <span className="text-muted-foreground">
          /{format ? format(ring.target) : ring.target}
        </span>
      </p>
      <p className="text-[0.65rem] text-muted-foreground">
        {ring.target === 0
          ? 'no target'
          : ring.remaining > 0
            ? `${format ? format(ring.remaining) : `${ring.remaining} ${unit}`} left`
            : ring.over && tone === 'warn'
              ? `${Math.abs(ring.remaining)} over`
              : 'done'}
      </p>
    </div>
  );
}
