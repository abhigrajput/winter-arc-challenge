'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { ProgressSource } from '@/components/landing/scroll-progress';
import { cn } from '@/lib/utils';
import { heroMode, snowCount } from '@/lib/landing/capability';
import { CssSnow } from '@/components/landing/css-snow';
import { SvgArc } from '@/components/landing/svg-arc';

/**
 * The hero background. The static gradient + CSS snow + SVG arc render on the
 * server, so the page is complete before any JavaScript runs. On capable
 * devices the WebGL scene is fetched on first interaction or at the first
 * idle period after load, then fades in over the fallback.
 */

const ArcScene = dynamic(() => import('@/components/landing/arc-scene'), { ssr: false });

/**
 * If the scene cannot start (no WebGL, lost context, driver bug), keep the
 * static fallback instead of breaking the page. This replaces a separate
 * WebGL probe: creating a throwaway context costs ~100 ms of main thread,
 * and the scene creates its own anyway.
 */
class SceneBoundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * With no interaction, the 3D bundle loads at the first idle period after the
 * page has loaded, or after this many ms at the latest.
 */
const IDLE_TIMEOUT_MS = 2000;
const INTERACTIONS = ['pointerdown', 'pointermove', 'touchstart', 'wheel', 'scroll', 'keydown'] as const;

/**
 * Runs `run` once: on the first interaction, or at the first idle period after
 * the headline has painted and the page has loaded (requestIdleCallback,
 * timeout IDLE_TIMEOUT_MS) — whichever comes first. Never during hydration,
 * and the 3D bytes never compete with the LCP paint.
 */
function whenEngagedOrIdle(run: () => void): () => void {
  let done = false;
  let timer: number | undefined;
  let idleId: number | undefined;
  let lcpObserver: PerformanceObserver | undefined;

  const fire = () => {
    if (done) return;
    done = true;
    cleanup();
    run();
  };
  const scheduleIdle = () => {
    if (done || idleId !== undefined || timer !== undefined) return;
    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(fire, { timeout: IDLE_TIMEOUT_MS });
    } else {
      // Safari has no requestIdleCallback: approximate "after load, soon".
      timer = window.setTimeout(fire, IDLE_TIMEOUT_MS);
    }
  };
  const onLoad = () => {
    // Wait for the hero headline's LCP before going idle-hunting.
    const supportsLcp =
      typeof PerformanceObserver !== 'undefined' &&
      PerformanceObserver.supportedEntryTypes?.includes('largest-contentful-paint');
    if (!supportsLcp) {
      scheduleIdle();
      return;
    }
    lcpObserver = new PerformanceObserver(() => {
      lcpObserver?.disconnect();
      scheduleIdle();
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  };
  function cleanup() {
    for (const type of INTERACTIONS) window.removeEventListener(type, fire);
    window.removeEventListener('load', onLoad);
    lcpObserver?.disconnect();
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
    // WebGL itself is not probed: the scene creates the context, and
    // SceneBoundary falls back if that fails.
    if (heroMode({ ...traits, webgl: true }) !== '3d') return;
    return whenEngagedOrIdle(() => {
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
          <SceneBoundary
            onFail={() => {
              setReady(false);
              setLoad3d(false);
            }}
          >
            <ArcScene
              progress={progress}
              active={heroVisible && tabVisible}
              snow={snow}
              onReady={() => setReady(true)}
            />
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
