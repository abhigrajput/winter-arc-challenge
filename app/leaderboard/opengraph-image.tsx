import { ImageResponse } from 'next/og';
import { createAnonClient } from '@/lib/supabase/server';
import { OG_COLORS, OG_SIZE, OgCard } from '@/components/og/card';

export const alt = 'Winter Arc leaderboard — ranked by discipline only.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

/** Live top 3 (all time), points and streak only. */
export default async function Image() {
  const { data } = await createAnonClient().rpc('get_leaderboard', { p_days: 3650, p_limit: 3 });
  const top = (data ?? []).slice(0, 3);

  return new ImageResponse(
    (
      <OgCard eyebrow="Leaderboard" title="Ranked by discipline.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {top.length === 0 ? (
            <div style={{ display: 'flex', fontSize: 34, color: OG_COLORS.MUTED }}>Points and streak. Nothing else.</div>
          ) : (
            top.map((row, i) => (
              <div key={row.user_id} style={{ display: 'flex', alignItems: 'baseline', gap: 24, fontSize: 36 }}>
                <span style={{ color: OG_COLORS.ACCENT, width: 40 }}>{i + 1}</span>
                <span style={{ flex: 1 }}>@{row.username ?? 'unknown'}</span>
                <span style={{ color: OG_COLORS.MUTED }}>{row.current_streak}d streak</span>
                <span style={{ width: 180, textAlign: 'right' }}>{row.points} pts</span>
              </div>
            ))
          )}
        </div>
      </OgCard>
    ),
    size,
  );
}
