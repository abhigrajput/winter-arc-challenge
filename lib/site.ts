/**
 * Canonical public origin, used for absolute metadata URLs (Open Graph).
 * NEXT_PUBLIC_SITE_URL wins; Vercel's production domain is the fallback.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://winter-arc-challenge-blue.vercel.app');
