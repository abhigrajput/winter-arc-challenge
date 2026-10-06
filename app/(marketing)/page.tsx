import { Suspense } from 'react';
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';
import { Hero } from '@/components/landing/hero';
import { DaysSection, FinalCta, HowItWorks, ModuleCards, StatsStrip, type TopUser } from '@/components/landing/sections';

export const metadata: Metadata = {
  title: { absolute: 'Winter Arc — 90 days. No excuses.' },
  description: 'Body. Mind. Discipline. Tracked. A 90-day transformation app: workouts, nutrition, skin, sleep, mind, and a leaderboard that ranks discipline only.',
};

/**
 * Static and cached: rebuilt at most every 5 minutes for the live top 3.
 * Signed-in visitors never see it — proxy.ts sends them to /today.
 */
export const revalidate = 300;

async function topThree(): Promise<TopUser[]> {
  try {
    // Cookie-less anon client: a public RPC, so the page stays cacheable.
    const supabase = createClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: { persistSession: false },
    });
    const { data } = await supabase.rpc('get_leaderboard', { p_days: 3650, p_limit: 3 });
    return (data ?? []).slice(0, 3).map((row) => ({
      username: row.username,
      displayName: row.display_name,
      points: row.points,
      streak: row.current_streak,
    }));
  } catch {
    return [];
  }
}

export default async function LandingPage() {
  const top = await topThree();

  return (
    <>
      <main className="overflow-x-clip bg-background">
        <Hero />
        {/*
          Each section is its own Suspense boundary so React hydrates it as a
          separate unit and yields to the main thread in between: no single
          long hydration task, so taps on the hero CTA are never held up.
        */}
        <Suspense fallback={null}>
          <DaysSection />
        </Suspense>
        <Suspense fallback={null}>
          <ModuleCards />
        </Suspense>
        <Suspense fallback={null}>
          <StatsStrip top={top} />
        </Suspense>
        <Suspense fallback={null}>
          <HowItWorks />
        </Suspense>
        <Suspense fallback={null}>
          <FinalCta />
        </Suspense>
        <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
          General guidance, not medical advice.
        </footer>
      </main>
    </>
  );
}
