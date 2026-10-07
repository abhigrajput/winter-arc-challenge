'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { DayCounterStatic } from '@/components/landing/day-counter-static';

/**
 * The animated counter (and framer-motion with it) is fetched only when its
 * section comes within ~600px of the viewport — never during the first paint.
 * Until then, and for crawlers and no-JS, the identical static markup shows.
 */
const DayCounter = dynamic(() => import('@/components/landing/day-counter'), {
  ssr: false,
  loading: () => <DayCounterStatic />,
});

export function DayCounterLazy() {
  const anchor = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = anchor.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={anchor}>{near ? <DayCounter /> : <DayCounterStatic />}</div>;
}
