import type { ReactNode } from 'react';

/**
 * Shared frame for generated share images (1200×630). ImageResponse supports
 * a flexbox subset of CSS only, so everything is inline styles.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const BG = '#0a0c10';
const FG = '#e8edf5';
const MUTED = '#8a94a6';
const ACCENT = '#7dd3fc';

export function OgCard({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: `radial-gradient(circle at 85% 10%, #13314a 0%, ${BG} 55%)`,
        color: FG,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, textTransform: 'uppercase', color: ACCENT }}>
          {eyebrow}
        </div>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {children}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: MUTED }}>
          <span>WINTER ARC</span>
          <span>Discipline is the only ranking.</span>
        </div>
      </div>
    </div>
  );
}

export function OgStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: MUTED }}>{label}</span>
      <span style={{ fontSize: 64, fontWeight: 700, color: FG }}>{value}</span>
    </div>
  );
}

export const OG_COLORS = { FG, MUTED, ACCENT };
