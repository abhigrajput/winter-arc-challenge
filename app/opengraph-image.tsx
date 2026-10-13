import { ImageResponse } from 'next/og';
import { OG_COLORS, OG_SIZE, OgCard } from '@/components/og/card';

export const alt = 'Winter Arc — 90 days. No excuses.';
export const size = OG_SIZE;
export const contentType = 'image/png';

/** Default share card for every page without its own (static, built once). */
export default function Image() {
  return new ImageResponse(
    (
      <OgCard eyebrow="90-day transformation" title="90 days. No excuses.">
        <div style={{ display: 'flex', fontSize: 34, color: OG_COLORS.MUTED }}>
          Body · Mind · Discipline. Tracked daily.
        </div>
      </OgCard>
    ),
    size,
  );
}
