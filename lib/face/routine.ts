/**
 * Skincare routine and jawline content (§8.3, §8.4).
 *
 * Two hard editorial rules, enforced by tests:
 *  - OTC actives only. No prescription medication is ever named.
 *  - No jaw devices, no mewing, no claims about changing bone structure.
 */

export interface RoutineStep {
  slug: string;
  product: string;
  instruction: string;
  /** Non-negotiable steps cannot be dropped from the routine. */
  essential: boolean;
}

/** §8.3: AM is cleanser, moisturiser, sunscreen SPF 30+. */
export const AM_ROUTINE: RoutineStep[] = [
  {
    slug: 'am_cleanser',
    product: 'Gentle cleanser',
    instruction: 'Lukewarm water, about 30 seconds, pat dry. No scrubbing.',
    essential: true,
  },
  {
    slug: 'am_moisturiser',
    product: 'Moisturiser',
    instruction: 'Apply while the skin is still slightly damp.',
    essential: true,
  },
  {
    slug: 'am_spf',
    product: 'Sunscreen SPF 30+',
    instruction: 'Two fingers for the face and neck. Reapply if you are out for hours.',
    essential: true,
  },
];

/** §8.3: PM is cleanser, moisturiser, and at most one optional OTC active. */
export const PM_ROUTINE: RoutineStep[] = [
  {
    slug: 'pm_cleanser',
    product: 'Gentle cleanser',
    instruction: 'Take off sweat and sunscreen properly.',
    essential: true,
  },
  {
    slug: 'pm_active',
    product: 'Optional: one OTC active',
    instruction: 'Only after two boring weeks. One product at a time, patch test first.',
    essential: false,
  },
  {
    slug: 'pm_moisturiser',
    product: 'Moisturiser',
    instruction: 'Always after an active, never instead of one.',
    essential: true,
  },
];

export interface OtcActive {
  slug: string;
  name: string;
  bestFor: string;
  startAt: string;
  caution: string;
}

/**
 * §8.3: the only actives this app will ever suggest. Adapalene is included
 * because it is sold over the counter in many places; anything prescription-
 * only is deliberately absent and the guardrails reject it in AI output too.
 */
export const OTC_ACTIVES: OtcActive[] = [
  {
    slug: 'benzoyl_peroxide',
    name: 'Benzoyl peroxide 2.5%',
    bestFor: 'Inflamed spots and whiteheads',
    startAt: 'Every other night, rinse off after 5 minutes for the first week',
    caution: 'Bleaches fabric. Start low — 2.5% works as well as 10% with less irritation.',
  },
  {
    slug: 'salicylic_acid',
    name: 'Salicylic acid 2%',
    bestFor: 'Blackheads and clogged pores',
    startAt: 'Every other night',
    caution: 'Stings on broken skin. Do not layer with another acid.',
  },
  {
    slug: 'niacinamide',
    name: 'Niacinamide 5%',
    bestFor: 'Redness and oiliness. The gentlest place to start.',
    startAt: 'Nightly',
    caution: 'Rarely irritating, but more is not better — 5% is plenty.',
  },
  {
    slug: 'adapalene',
    name: 'Adapalene 0.1%',
    bestFor: 'Persistent clogged pores and texture',
    startAt: 'Twice a week, building up over a month',
    caution: 'Purging for several weeks is normal. Sunscreen is not optional on this one.',
  },
];

export const ACTIVE_INTRO_RULE =
  'One new product at a time. Patch test on the jawline for two nights, then introduce it slowly over two weeks.';

/** §8.3: when a routine is the wrong answer. */
export const DERM_REFERRAL =
  'Deep painful lumps, cysts, scarring, or a sudden change in your skin need a dermatologist, not a routine change. That is a medical problem and worth treating properly.';

export interface SkinFlagInput {
  /** Recent breakout scores, newest first. */
  recentScores: number[];
  notes: string;
}

/**
 * Raises the §8.3 referral when the log suggests something a routine will not
 * fix: sustained severe scores, or language describing cysts or scarring.
 */
export function needsDermReferral({ recentScores, notes }: SkinFlagInput): boolean {
  const severe = recentScores.filter((score) => score >= 4);
  if (recentScores.length >= 5 && severe.length >= 4) return true;
  return /\b(cyst|cystic|nodul\w*|scar\w*|abscess)\b/i.test(notes);
}

// ---------------------------------------------------------------------------
// §8.4 jawline
// ---------------------------------------------------------------------------

/**
 * §8.4 requires the truth up front: jawline definition comes from facial fat,
 * neck and posture, and genetics. Bone structure is fixed after growth.
 */
export const JAWLINE_TRUTH = [
  'A visible jawline is mostly facial fat level. That follows your overall body fat, and you cannot spot-reduce it.',
  'Neck training and posture change how the jaw and neck line reads. That part is trainable.',
  'Bone structure is genetic and fixed once you finish growing. Nothing here changes it.',
  'Sodium, alcohol and poor sleep cause puffiness that hides the jawline for a day or two.',
];

/** §8.4 explicitly forbids promoting these. */
export const JAWLINE_NOT_RECOMMENDED = [
  'Jaw exerciser devices — they load the jaw joint and risk TMJ problems.',
  'Mewing — not proven to change adult bone structure, whatever the claims.',
  'Anything advertised as reshaping the jawbone.',
];

export interface JawlineDrill {
  slug: string;
  name: string;
  dose: string;
  cue: string;
}

/** §8.4: light, progressive neck work and posture drills. */
export const JAWLINE_DRILLS: JawlineDrill[] = [
  {
    slug: 'chin_tuck',
    name: 'Chin tuck',
    dose: '2 sets of 10, hold 3 seconds',
    cue: 'Glide the chin straight back, eyes level. Stop at anything sharp.',
  },
  {
    slug: 'wall_angel',
    name: 'Wall angel',
    dose: '2 sets of 8, slow',
    cue: 'Lower back, upper back and head stay on the wall the whole way.',
  },
  {
    slug: 'neck_curl',
    name: 'Neck curl',
    dose: '2 sets of 10, bodyweight only',
    cue: 'Lie on your back, tuck the chin, lift slowly. No added load for the first month.',
  },
  {
    slug: 'neck_extension',
    name: 'Neck extension',
    dose: '2 sets of 10, small range',
    cue: 'Face down, lift through a short range. Control both directions.',
  },
];

export const FACE_PHOTO_PROMPT =
  'Same spot, same light, same time of day, head level and relaxed. Lighting changes the jawline more than a week of training does.';
