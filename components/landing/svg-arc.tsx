'use client';

import { useEffect, useId, useRef } from 'react';
import { ARC_LENGTH, ARC_PATH, ARC_VIEWBOX } from '@/components/landing/arc-path';
import type { ProgressSource } from '@/components/landing/scroll-progress';

/**
 * The icon's arc, filled by scroll progress (0..1). The no-WebGL hero. For a
 * fully filled, non-moving arc use StaticArc (server, no JS).
 */
export function SvgArc({ progress, className }: { progress: ProgressSource; className?: string }) {
  const glowId = `wa-arc-glow-${useId().replace(/:/g, '')}`;
  const fill = useRef<SVGPathElement>(null);

  useEffect(
    () =>
      progress.subscribe((p) => {
        fill.current?.setAttribute('stroke-dashoffset', String(ARC_LENGTH * (1 - Math.min(1, Math.max(0, p)))));
      }),
    [progress],
  );

  return (
    <svg viewBox={ARC_VIEWBOX} className={className} aria-hidden>
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={ARC_PATH} fill="none" stroke="#26aff3" strokeOpacity={0.12} strokeWidth={9} strokeLinecap="round" />
      <path
        ref={fill}
        d={ARC_PATH}
        fill="none"
        stroke="#26aff3"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={ARC_LENGTH}
        filter={`url(#${glowId})`}
      />
    </svg>
  );
}
