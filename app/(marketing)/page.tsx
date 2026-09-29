import Link from 'next/link';
import { Button } from '@/components/ui/button';

const PILLARS = [
  ['Body', 'Gym or home. Logged sets, real progression.'],
  ['Abs', 'Body fat down. Core trained. No shortcuts sold.'],
  ['Face', 'Skin routine, jawline, sleep, water.'],
  ['Nutrition', 'Calories, protein, water. Indian food defaults.'],
  ['Mind', 'Reading, meditation, Gita, skill.'],
  ['Work', 'Ship content. Track output.'],
];

export default function MarketingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-12 px-6 py-16">
      <div className="space-y-5">
        <p className="label-xs">90 days</p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Winter Arc</h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          One app for the whole transformation. Daily checklist, workout logger, macros,
          measurements, photos, AI coach. Discipline is the only thing ranked.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        {PILLARS.map(([title, body]) => (
          <li key={title} className="bg-card p-5">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:w-40">
          <Link href="/login">Start Day 1</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="sm:w-40">
          <Link href="/leaderboard">Leaderboard</Link>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">General guidance, not medical advice.</p>
    </main>
  );
}
