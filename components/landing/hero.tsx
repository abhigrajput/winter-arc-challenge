'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { arcDay } from '@/lib/landing/capability';
import { HeroBackdrop } from '@/components/landing/hero-backdrop';
import { useSectionProgress } from '@/components/landing/scroll-progress';

/**
 * Full-screen hero. 200svh tall with a sticky stage: scrolling through it
 * fills the arc from day 0 to 90. Headline and CTAs are plain HTML in the
 * server response — they never wait for WebGL and are not animated in, so
 * they are the LCP element as soon as the font is ready.
 *
 * No framer-motion here: the hero is on the critical path, so scroll progress
 * is a single passive listener (scroll-progress.ts) and the readout is
 * updated by writing text directly.
 */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  const dayLabel = useRef<HTMLSpanElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  const progress = useSectionProgress(section);
  const [visible, setVisible] = useState(true);

  useEffect(
    () =>
      progress.subscribe((p) => {
        if (dayLabel.current) dayLabel.current.textContent = String(arcDay(p)).padStart(2, '0');
        if (cue.current) cue.current.style.opacity = String(Math.max(0, 1 - p / 0.08));
      }),
    [progress],
  );

  // Stop rendering the scene once the hero has scrolled away.
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(Boolean(entry?.isIntersecting)), {
      rootMargin: '100px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={section} className="relative h-[200svh]" aria-labelledby="hero-heading">
      <div className="sticky top-0 h-svh overflow-hidden">
        <HeroBackdrop progress={progress} heroVisible={visible} />

        <div className="relative z-10 mx-auto flex h-full max-w-3xl flex-col items-center justify-center gap-6 px-4 text-center">
          <p className="label-xs text-primary">Winter Arc</p>
          <h1
            id="hero-heading"
            className="text-balance text-5xl font-semibold tracking-tight text-foreground drop-shadow-[0_2px_24px_rgba(10,12,16,0.9)] sm:text-7xl"
          >
            90 days. No excuses.
          </h1>
          <p className="text-lg text-muted-foreground sm:text-xl">Body. Mind. Discipline. Tracked.</p>

          <div className="flex w-full max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <Link
              href="/login?tab=signup"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-primary px-6 text-base font-medium text-primary-foreground shadow-[0_0_32px_hsl(199_89%_55%/0.35)] transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Start your Winter Arc
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-background/40 px-6 text-base font-medium backdrop-blur transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              See leaderboard
            </Link>
          </div>

          <p className="font-mono text-xs text-muted-foreground">
            Day{' '}
            <span ref={dayLabel} className="tabular-nums text-foreground" data-testid="hero-day">
              00
            </span>{' '}
            / 90
          </p>
        </div>

        <div ref={cue} className="absolute inset-x-0 bottom-6 z-10 flex justify-center text-muted-foreground" aria-hidden>
          <ChevronDown className="size-5 animate-bounce motion-reduce:animate-none" />
        </div>
      </div>
    </section>
  );
}
