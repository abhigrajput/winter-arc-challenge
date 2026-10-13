import { ImageResponse } from 'next/og';
import { createAnonClient } from '@/lib/supabase/server';
import { CHALLENGE_DAYS, challengeDayOn } from '@/lib/calc/day';
import { sortForDisplay } from '@/lib/achievements';
import { OG_COLORS, OG_SIZE, OgCard, OgStat } from '@/components/og/card';

export const alt = 'Winter Arc public profile — day count, streak and badges.';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 3600;

/**
 * Same data the public profile shows: day, streak, badge count. A private or
 * unknown username gets the generic card, so the image never confirms that an
 * account exists.
 */
export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const handle = (await params).username.toLowerCase();
  const supabase = createAnonClient();

  const { data: profile } = await supabase
    .from('public_profiles')
    .select('id, username, display_name, challenge_start')
    .eq('username', handle)
    .maybeSingle();

  const [{ data: stats }, { data: streak }] = profile
    ? await Promise.all([
        supabase.rpc('get_public_profile', { p_username: handle }),
        supabase.rpc('get_streak', { p_user: profile.id }),
      ])
    : [{ data: null }, { data: null }];

  if (!profile || !stats) {
    return new ImageResponse(
      (
        <OgCard eyebrow="Public profile" title="90 days. No excuses.">
          <div style={{ display: 'flex', fontSize: 34, color: OG_COLORS.MUTED }}>Discipline, tracked daily.</div>
        </OgCard>
      ),
      size,
    );
  }

  const day = Math.max(0, challengeDayOn(profile.challenge_start, stats.today));
  const name = profile.display_name || `@${profile.username}`;
  const badges = sortForDisplay(new Set(stats.achievements)).filter((a) => a.earned).length;

  return new ImageResponse(
    (
      <OgCard eyebrow={`@${profile.username}`} title={name.length > 22 ? `${name.slice(0, 21)}…` : name}>
        <div style={{ display: 'flex', gap: 96 }}>
          <OgStat label="Day" value={`${Math.min(day, CHALLENGE_DAYS)}/${CHALLENGE_DAYS}`} />
          <OgStat label="Streak" value={`${streak ?? 0}d`} />
          <OgStat label="Badges" value={String(badges)} />
        </div>
      </OgCard>
    ),
    size,
  );
}
