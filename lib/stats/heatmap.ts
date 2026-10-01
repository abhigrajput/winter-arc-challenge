import { CHALLENGE_DAYS } from '@/lib/calc/day';
import type { DaySummary } from '@/lib/calc/streak';

/**
 * Shape of the /stats completion grid.
 *
 * Pure, so it lives outside lib/stats/load.ts — that module is server-only and
 * cannot be imported by a test or a client component.
 */

export interface HeatmapCell extends DaySummary {
  /** 1-based day of the challenge. */
  dayNumber: number;
  /**
   * 13 weeks is 91 cells but the arc is 90 days, so the last cell falls
   * outside it. Marked rather than drawn as an empty day, which would read
   * as a day that was missed.
   */
  inRange: boolean;
}

/** Groups day summaries into the 13x7 grid for the heatmap. */
export function heatmapWeeks(days: DaySummary[], startDate: string | null): HeatmapCell[][] {
  if (!startDate) return [];
  const byDate = new Map(days.map((d) => [d.date, d]));
  const weeks: HeatmapCell[][] = [];

  for (let week = 0; week < 13; week += 1) {
    const row: HeatmapCell[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const dayNumber = week * 7 + offset + 1;
      const date = addDays(startDate, dayNumber - 1);
      const summary = byDate.get(date) ?? { date, completed: 0, active: 0 };
      row.push({ ...summary, dayNumber, inRange: dayNumber <= CHALLENGE_DAYS });
    }
    weeks.push(row);
  }

  return weeks;
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
