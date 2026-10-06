import type { MetadataRoute } from 'next';

/** Public pages are crawlable; the signed-in app and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/leaderboard', '/u/'],
        disallow: [
          '/api/',
          '/auth/',
          '/onboarding',
          '/today',
          '/train',
          '/nutrition',
          '/body',
          '/face',
          '/plan',
          '/checkin',
          '/stats',
          '/tasks',
          '/achievements',
          '/settings',
        ],
      },
    ],
  };
}
