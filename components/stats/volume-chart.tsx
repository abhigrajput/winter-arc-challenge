'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/** Session volume over time. Bodyweight-only sessions sit at zero by design. */
export function VolumeChart({ data }: { data: { date: string; volume: number }[] }) {
  if (data.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Log a couple of sessions to see your volume trend.
      </p>
    );
  }

  const allZero = data.every((d) => d.volume === 0);

  return (
    <div className="space-y-2">
      <div className="h-44 w-full rounded-lg border border-border bg-card p-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => String(value).slice(5)}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))' }}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value) => [`${value} kg`, 'Volume']}
            />
            <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {allZero ? (
        <p className="text-xs text-muted-foreground">
          All bodyweight so far, so there is no external load to total.
        </p>
      ) : null}
    </div>
  );
}
