import { cn } from '@/lib/utils';
import { STREAK_THRESHOLD } from '@/lib/calc/streak';
import type { HeatmapCell } from '@/lib/stats/heatmap';

/**
 * 13x7 completion heatmap for the whole arc.
 *
 * Shaded by how much of each day was done, with the 80% streak bar as its own
 * step so a glance shows which days actually banked.
 */
export function CompletionHeatmap({
  weeks,
  today,
}: {
  weeks: HeatmapCell[][];
  today: string;
}) {
  if (weeks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        The heatmap fills in once your start date is set.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex gap-1 overflow-x-auto">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day) =>
              day.inRange ? (
                <span
                  key={day.date}
                  title={`Day ${day.dayNumber} · ${day.date}: ${day.active > 0 ? `${day.completed}/${day.active}` : 'no tasks'}`}
                  aria-label={`Day ${day.dayNumber}, ${day.active > 0 ? `${day.completed} of ${day.active} done` : 'nothing logged'}`}
                  className={cn(
                    'size-3 rounded-[2px]',
                    shade(day),
                    day.date === today && 'ring-1 ring-foreground/60',
                  )}
                />
              ) : (
                // Past day 90: outside the arc, so it is not a missed day.
                <span
                  key={day.date}
                  aria-hidden
                  title="Past day 90"
                  className="size-3 rounded-[2px] border border-dashed border-border/60"
                />
              ),
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[0.65rem] text-muted-foreground">
        <span>Less</span>
        <span className="size-3 rounded-[2px] bg-muted" />
        <span className="size-3 rounded-[2px] bg-primary/25" />
        <span className="size-3 rounded-[2px] bg-primary/50" />
        <span className="size-3 rounded-[2px] bg-primary/75" />
        <span className="size-3 rounded-[2px] bg-primary" />
        <span>More</span>
      </div>
    </div>
  );
}

function shade(day: HeatmapCell): string {
  if (day.active === 0) return 'bg-muted';
  const ratio = day.completed / day.active;
  if (ratio === 0) return 'bg-muted';
  if (ratio < 0.5) return 'bg-primary/25';
  if (ratio < STREAK_THRESHOLD) return 'bg-primary/50';
  if (ratio < 1) return 'bg-primary/75';
  return 'bg-primary';
}
