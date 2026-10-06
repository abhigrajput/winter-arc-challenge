'use client';

import dynamic from 'next/dynamic';
import { DayCounterStatic } from '@/components/landing/day-counter-static';

/**
 * The animated counter (and framer-motion with it) loads after hydration.
 * Until then — and for crawlers and no-JS — the identical static markup shows.
 */
export const DayCounterLazy = dynamic(() => import('@/components/landing/day-counter'), {
  ssr: false,
  loading: () => <DayCounterStatic />,
});
