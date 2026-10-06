'use client';

import { useRef, type ReactNode } from 'react';

/**
 * Card that tilts toward the mouse with a soft glow under the cursor.
 * Mouse only (no touch tilt), and nothing moves under reduced motion.
 */
export function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg)`;
    el.style.setProperty('--glow-x', `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty('--glow-y', `${((y + 0.5) * 100).toFixed(1)}%`);
  }

  function onLeave() {
    if (ref.current) ref.current.style.transform = '';
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="group relative h-full rounded-lg border border-border bg-card/70 p-5 transition-transform duration-200 ease-out hover:border-primary/40"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(240px circle at var(--glow-x,50%) var(--glow-y,50%), hsl(199 89% 55% / 0.12), transparent 70%)' }}
      />
      {children}
    </div>
  );
}
