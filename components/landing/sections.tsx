import Link from 'next/link';
import { ArrowRight, Bot, Brain, Dumbbell, Flame, Moon, Salad, ScanFace, Sparkles, Trophy } from 'lucide-react';
import { DayCounterLazy } from '@/components/landing/day-counter-lazy';
import { TiltCard } from '@/components/landing/tilt-card';
import { StaticArc } from '@/components/landing/static-arc';

/**
 * Landing sections below the hero. Server components: the only JavaScript
 * here is the day counter and the tilt cards. Scroll-in reveals are CSS
 * scroll-driven animations (.wa-reveal in globals.css) — no observers, and
 * fully visible where unsupported or with reduced motion.
 */

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="wa-reveal space-y-3 text-center">
      <p className="label-xs text-primary">{eyebrow}</p>
      <h2 id={id} className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

export function DaysSection() {
  return (
    <section aria-labelledby="days-heading" className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
      <SectionHeading id="days-heading" eyebrow="The arc" title="Four phases. Thirteen weeks." />
      <DayCounterLazy />
    </section>
  );
}

const MODULES = [
  { icon: Dumbbell, title: 'Training', copy: 'Gym or home. Logged sets, rest timer, auto PRs, real progression.' },
  { icon: Flame, title: 'Abs', copy: 'Core progressions plus an honest Abs ETA from your body fat trend.' },
  { icon: Sparkles, title: 'Clear skin', copy: 'AM/PM routine, breakout log, correlation with sleep and food.' },
  { icon: ScanFace, title: 'Jawline', copy: 'Body fat, neck and posture work. No gimmicks, no mewing myths.' },
  { icon: Salad, title: 'Nutrition', copy: 'Calories, protein, water. Indian food defaults and mess mode.' },
  { icon: Moon, title: 'Sleep', copy: 'Bed, wake, quality. A recovery score that adjusts your training.' },
  { icon: Brain, title: 'Mind / Spirit', copy: 'Reading, meditation, Gita tracker, skill timers.' },
  { icon: Bot, title: 'AI coach', copy: 'Weekly plans and check-ins, bounded by hard safety rules.' },
];

export function ModuleCards() {
  return (
    <section aria-labelledby="modules-heading" className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
      <SectionHeading id="modules-heading" eyebrow="One app" title="Everything the 90 days touch." />
      <ul className="mt-12 grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {MODULES.map(({ icon: Icon, title, copy }) => (
          <li key={title} className="wa-reveal">
            <TiltCard>
              <Icon className="size-5 text-primary" aria-hidden />
              <p className="mt-4 text-sm font-semibold">{title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
            </TiltCard>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface TopUser {
  username: string | null;
  displayName: string | null;
  points: number;
  streak: number;
}

export function StatsStrip({ top }: { top: TopUser[] }) {
  return (
    <section aria-labelledby="stats-heading" className="border-y border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 id="stats-heading" className="flex items-center gap-2 text-sm font-semibold">
              <Trophy className="size-4 text-primary" aria-hidden /> Live leaderboard
            </h2>
            <p className="text-xs text-muted-foreground">Discipline only. Points and streak — never body data.</p>
          </div>
          <Link href="/leaderboard" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline">
            Full board <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>

        {top.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">The board is empty. Day 1 could put you on top.</p>
        ) : (
          <ol className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="landing-top3">
            {top.map((u, i) => (
              <li key={`${u.username}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-4">
                <span className="font-mono text-lg text-primary">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.displayName || u.username}</span>
                  {u.username ? <span className="block truncate font-mono text-xs text-muted-foreground">@{u.username}</span> : null}
                </span>
                <span className="text-right font-mono text-xs">
                  <span className="block text-sm tabular-nums">{u.points} pts</span>
                  <span className="flex items-center justify-end gap-1 text-muted-foreground">
                    <Flame className="size-3" aria-hidden /> {u.streak}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

const STEPS = [
  ['Sign up', 'Name, email, password. No email to confirm.'],
  ['Set your goal', 'Fat loss, lean bulk, recomp, six pack, discipline or spiritual.'],
  ['Daily checklist', '80% of today’s tasks keeps the streak alive.'],
  ['Weekly AI check-in', 'Seven days of data in, three changes for next week out.'],
] as const;

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto max-w-5xl px-4 py-24 sm:py-32">
      <SectionHeading id="how-heading" eyebrow="How it works" title="Four steps. Then ninety days." />
      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(([title, copy], i) => (
          <li key={title} className="wa-reveal h-full rounded-lg border border-border bg-card/60 p-5">
            <span className="font-mono text-xs text-primary">0{i + 1}</span>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="final-heading" className="relative overflow-hidden px-4 py-28 sm:py-36">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,hsl(199_89%_55%/0.12),transparent_60%)]" />
      <div className="wa-reveal relative mx-auto flex max-w-xl flex-col items-center gap-8 text-center">
        <div className="relative w-56 sm:w-64">
          <StaticArc className="w-full" />
          <p className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-5xl font-semibold text-primary">90</span>
            <span className="label-xs">days</span>
          </p>
        </div>
        <h2 id="final-heading" className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          The arc fills one day at a time.
        </h2>
        <Link
          href="/login?tab=signup"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-medium text-primary-foreground shadow-[0_0_32px_hsl(199_89%_55%/0.35)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Start your Winter Arc
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
