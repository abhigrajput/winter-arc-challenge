'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LazyMotion,
  animate,
  domAnimation,
  m,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { phaseForDay, type PhaseName } from '@/lib/calc/day';
import { DayCounterLayout } from '@/components/landing/day-counter-static';

/**
 * Day 1 → 90 count-up as the section scrolls into view, with the §7 phases
 * lighting up as it passes them. framer-motion lives here, below the fold,
 * and this module is loaded lazily (day-counter-lazy.tsx) — never part of the
 * initial page JavaScript.
 */
export default function DayCounter() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-120px' });
  const reduced = useReducedMotion();
  const day = useMotionValue(1);
  const shown = useTransform(day, (v) => String(Math.round(v)));
  const [phase, setPhase] = useState<PhaseName>('Foundation');

  useMotionValueEvent(day, 'change', (v) => {
    const next = phaseForDay(Math.round(v)).name;
    setPhase((prev) => (prev === next ? prev : next));
  });

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      day.set(90);
      return;
    }
    const controls = animate(day, 90, { duration: 3.2, ease: [0.4, 0, 0.2, 1] });
    return () => controls.stop();
  }, [inView, reduced, day]);

  return (
    <LazyMotion features={domAnimation} strict>
      <div ref={ref} className="mt-12 flex flex-col items-center gap-10">
        <DayCounterLayout day={<m.span>{shown}</m.span>} phase={phase} />
      </div>
    </LazyMotion>
  );
}
