'use client';

import { useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '@/lib/calc/body';
import { cn } from '@/lib/utils';

/**
 * §8.6: the 7-day average is the signal; daily scale weight is noise and is
 * hidden by default.
 */
export function WeightChart({ points }: { points: TrendPoint[] }) {
  const [showDaily, setShowDaily] = useState(false);

  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Log your weight on two different days to see a trend.
      </p>
    );
  }

  const weights = points.flatMap((p) => [p.weightKg, p.averageKg ?? p.weightKg]);
  const min = Math.floor(Math.min(...weights) - 1);
  const max = Math.ceil(Math.max(...weights) + 1);

  return (
    <div className="space-y-2">
      <div className="h-56 w-full rounded-lg border border-border bg-card p-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(5)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={[min, max]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
              formatter={(value, name) => [
                `${value ?? '-'} kg`,
                name === 'averageKg' ? '7-day average' : 'Scale',
              ]}
            />
            {showDaily ? (
              <Line
                type="monotone"
                dataKey="weightKg"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1}
                dot={false}
                strokeDasharray="3 3"
              />
            ) : null}
            <Line
              type="monotone"
              dataKey="averageKg"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button
        type="button"
        onClick={() => setShowDaily((v) => !v)}
        className={cn(
          'text-xs underline-offset-4 hover:underline',
          showDaily ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {showDaily ? 'Hide daily readings' : 'Show daily readings'}
      </button>
    </div>
  );
}
