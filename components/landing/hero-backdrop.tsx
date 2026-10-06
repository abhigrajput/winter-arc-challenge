'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ProgressSource } from '@/components/landing/scroll-progress';
import { cn } from '@/lib/utils';
import { heroMode, snowCount } from '@/lib/landing/capability';
import { CssSnow } from '@/components/landing/css-snow';
import { SvgArc } from '@/components/landing/svg-arc';

/**
 * The hero background. The static gradient + CSS snow + SVG arc render on the
 * server, so the page is complete before any JavaScript runs. On capable
 * devices the WebGL scene is fetched on first interaction, or a few seconds
 * after load once the main thread is idle, then fades in over the fallback.
 */

const ArcScene = dynamic(() => import('@/components/landing/arc-scene'), { ssr: false });

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Quiet time after load before the 3D bundle is fetched without any interaction. */
const IDLE_DELAY_MS = 3500;
const INTERACTIONS = ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;

/**
 * Runs `run` once: on the first interaction, or IDLE_DELAY_MS after the page
 * has loaded and the main thread is idle — whichever comes first. Parsing
 * three.js is ~1 s of main-thread work on a mid-range phone; doing it while
 * the page is still settling would block taps on the CTA.
 */
function whenEngagedOrIdle(run: () => void): () => void {
  let done = false;
  let timer: number | undefined;
  let idleId: number | undefined;

  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };
  const onLoad = () => {
    timer = window.setTimeout(() => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1));
      idleId = ric(fire, { timeout: 2000 } as IdleRequestOptions);
    }, IDLE_DELAY_MS);
  };
  function cleanup() {
    for (const type of INTERACTIONS) window.removeEventListener(type, fire);
    window.removeEventListener('load', onLoad);
    if (timer !== undefined) window.clearTimeout(timer);
    if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
  }

  for (const type of INTERACTIONS) window.addEventListener(type, fire, { once: true, passive: true });
  if (document.readyState === 'complete') onLoad();
  else window.addEventListener('load', onLoad, { once: true });

  return () => {
    done = true;
    cleanup();
  };
}

export function HeroBackdrop({
  progress,
  heroVisible,
}: {
  progress: ProgressSource;
  heroVisible: boolean;
}) {
  const [load3d, setLoad3d] = useState(false);
  const [ready, setReady] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [snow, setSnow] = useState(500);

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const traits = {
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory,
      saveData: nav.connection?.saveData,
    };
    // Cheap checks now; assume WebGL until probed.
    if (heroMode({ ...traits, webgl: true }) !== '3d') return;
    return whenEngagedOrIdle(() => {
      // Creating a WebGL context is expensive (GPU process start-up), so the
      // probe runs here, deferred, never during hydration.
      if (heroMode({ ...traits, webgl: webglAvailable() }) !== '3d') return;
      setSnow(snowCount(window.innerWidth));
      setLoad3d(true);
    });
  }, []);

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  return (
    <div className="absolute inset-0" aria-hidden data-hero-mode={ready ? '3d' : 'fallback'}>
      {/* Static layer: always present, so there is never an empty frame. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,hsl(199_89%_55%/0.16),transparent_60%),linear-gradient(to_bottom,#0a0c10,#070a12_60%,#0a0c10)]" />
      <div className={cn('absolute inset-0 transition-opacity duration-1000', ready && 'opacity-0')}>
        <CssSnow />
        <SvgArc progress={progress} className="absolute left-1/2 top-1/2 w-[min(78vw,62vh)] -translate-x-1/2 -translate-y-1/2" />
      </div>

      {load3d ? (
        <div className={cn('absolute inset-0 opacity-0 transition-opacity duration-1000', ready && 'opacity-100')}>
          <ArcScene
            progress={progress}
            active={heroVisible && tabVisible}
            snow={snow}
            onReady={() => setReady(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
