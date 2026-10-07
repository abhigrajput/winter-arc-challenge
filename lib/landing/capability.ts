/**
 * Landing page: decide whether to run the WebGL hero or the static fallback.
 *
 * Fallback (static gradient + CSS snow) when any of:
 *   - prefers-reduced-motion
 *   - no WebGL
 *   - low-end device: hardwareConcurrency ≤ 4 or deviceMemory ≤ 4 (GB)
 *   - Save-Data on
 * Unknown values (deviceMemory is Chromium-only) do not count against a device.
 *
 * Pure: the component reads navigator/matchMedia and passes the values in.
 */

export interface DeviceTraits {
  reducedMotion: boolean;
  webgl: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
}

export type HeroMode = '3d' | 'fallback';

export const LOW_END_CORES = 4;
export const LOW_END_MEMORY_GB = 4;

export function isLowEnd(traits: Pick<DeviceTraits, 'hardwareConcurrency' | 'deviceMemory'>): boolean {
  const cores = traits.hardwareConcurrency;
  const memory = traits.deviceMemory;
  return (cores !== undefined && cores > 0 && cores <= LOW_END_CORES) ||
    (memory !== undefined && memory > 0 && memory <= LOW_END_MEMORY_GB);
}

export function heroMode(traits: DeviceTraits): HeroMode {
  if (traits.reducedMotion || !traits.webgl || traits.saveData) return 'fallback';
  if (isLowEnd(traits)) return 'fallback';
  return '3d';
}

/**
 * When the 3D scene may load, by device:
 * - 'interaction': phones/tablets (coarse pointer or narrow viewport) load it
 *   only on the first touch, scroll or key. Their CPUs pay most for parsing
 *   three.js, and an idle load would land while the page is still settling.
 * - 'interaction-or-idle': desktops also load it once the headline has
 *   painted and the browser is idle (see hero-backdrop.tsx).
 */
export type LoadTrigger = 'interaction' | 'interaction-or-idle';

export const MOBILE_MAX_WIDTH = 768;

export function loadTrigger({ coarsePointer, viewportWidth }: { coarsePointer: boolean; viewportWidth: number }): LoadTrigger {
  return coarsePointer || viewportWidth < MOBILE_MAX_WIDTH ? 'interaction' : 'interaction-or-idle';
}

/** Snow particle count: ~1500 on desktop, ~500 on phones. */
export function snowCount(viewportWidth: number): number {
  return viewportWidth < 768 ? 500 : 1500;
}

/**
 * How far a tall section with a sticky stage has been scrolled, 0..1:
 * 0 when its top reaches the viewport top, 1 when its bottom reaches the
 * viewport bottom. (framer-motion's offset ['start start', 'end end'].)
 */
export function scrollProgress(top: number, height: number, viewportHeight: number): number {
  const travel = height - viewportHeight;
  if (travel <= 0) return top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / travel));
}

/** Scroll progress through the hero (0..1) → day of the arc (0..90). */
export function arcDay(progress: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  return Math.round(clamped * 90);
}
