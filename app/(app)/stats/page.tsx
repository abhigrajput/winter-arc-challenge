import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/profile';
import { loadStats, heatmapWeeks } from '@/lib/stats/load';
import { CHALLENGE_DAYS } from '@/lib/calc/day';
import { BODY_FAT_ERROR_MARGIN } from '@/lib/calc/bodyfat';
import { POINTS } from '@/lib/calc/points';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { CompletionHeatmap } from '@/components/stats/heatmap';
import { VolumeChart } from '@/components/stats/volume-chart';
import { WeightChart } from '@/components/body/weight-chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Stats' };
export const dynamic = 'force-dynamic';

export default async function StatsPage() {
  const { profile } = await requireUser();
  if (!profile) return null;

  const stats = await loadStats(profile);
  const weeks = heatmapWeeks(stats.discipline.days, profile.challenge_start);
  const points = stats.discipline.points;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="label-xs">
          Day {stats.day} / {CHALLENGE_DAYS}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Points" value={points.total} />
        <Stat label="Streak" value={stats.discipline.streak.current} />
        <Stat label="Best" value={stats.discipline.streak.longest} />
      </section>

      <section className="space-y-2">
        <h2 className="label-xs">Every day so far</h2>
        <CompletionHeatmap weeks={weeks} today={stats.logDate} />
      </section>

      {stats.absEta ? (
        <Card>
          <CardHeader>
            <CardTitle>Abs ETA</CardTitle>
            <CardDescription>
              At your current rate of loss. A projection, not a promise.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-mono text-3xl">
              {stats.absEta.weeksLow}-{stats.absEta.weeksHigh} weeks
            </p>
            <p className="text-xs text-muted-foreground">
              From about {stats.absEta.currentBodyFat}% to the {stats.absEta.targetLow}-
              {stats.absEta.targetHigh}% range where abs usually show. The estimate itself is
              good to about {BODY_FAT_ERROR_MARGIN} points either way, so treat the number as a
              direction.
            </p>
          </CardContent>
        </Card>
      ) : stats.bodyFat ? (
        <Card>
          <CardHeader>
            <CardTitle>Abs ETA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No projection while weight is steady or rising. Log weight regularly and it appears
              once there is a downward trend.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-2">
        <h2 className="label-xs">Weight</h2>
        <WeightChart points={stats.weightPoints} />
      </section>

      <section className="space-y-2">
        <h2 className="label-xs">Session volume</h2>
        <VolumeChart data={stats.volumeByDate} />
      </section>

      <section className="space-y-2">
        <h2 className="label-xs">Totals</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          <Row label="Workouts logged" value={stats.totals.sessions} />
          <Row label="Personal records" value={stats.totals.personalRecords} />
          <Row label="Surya Namaskar rounds" value={stats.totals.suryaRounds} />
          <Row label="Gita chapters" value={`${stats.totals.gitaChapters}/18`} />
          <Row label="Posts published" value={stats.totals.contentPosts} />
          <Row label="Check-ins" value={stats.totals.checkins} />
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="label-xs">Where the points came from</h2>
        <ul className="overflow-hidden rounded-lg border border-border">
          <Row label={`Tasks (${POINTS.task} each)`} value={points.tasks} />
          <Row label={`Full days (+${POINTS.fullDay})`} value={points.fullDays} />
          <Row label={`Workouts (+${POINTS.workout})`} value={points.workouts} />
          <Row label={`Check-ins (+${POINTS.checkin})`} value={points.checkins} />
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="label-xs">Achievements</h2>
          <span className="font-mono text-xs text-muted-foreground">
            {stats.earnedCodes.size}/{ACHIEVEMENTS.length}
          </span>
        </div>
        <Link href="/achievements" className={buttonVariants({ variant: 'outline', className: 'w-full' })}>
          See all badges
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className="label-xs">{label}</p>
      <p className="font-mono text-2xl">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number | string }) {
  return (
    <li className="flex items-baseline justify-between border-t border-border bg-card p-3 px-4 first:border-t-0">
      <span className="text-sm">{label}</span>
      <span className="font-mono text-sm">{value}</span>
    </li>
  );
}
