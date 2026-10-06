import { ARC_LENGTH, ARC_PATH, ARC_VIEWBOX } from '@/components/landing/arc-path';

/** The icon's 270° arc, fully filled. Server-rendered, no JavaScript. */
export function StaticArc({ className }: { className?: string }) {
  return (
    <svg viewBox={ARC_VIEWBOX} className={className} aria-hidden>
      <defs>
        <filter id="wa-static-arc-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={ARC_PATH} fill="none" stroke="#26aff3" strokeOpacity={0.12} strokeWidth={9} strokeLinecap="round" />
      <path
        d={ARC_PATH}
        fill="none"
        stroke="#26aff3"
        strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={ARC_LENGTH}
        strokeDashoffset={0}
        filter="url(#wa-static-arc-glow)"
      />
    </svg>
  );
}
