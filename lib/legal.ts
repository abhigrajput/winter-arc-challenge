/** Shared facts for /privacy and /terms. Update LAST_UPDATED when either changes. */
export const LEGAL = {
  lastUpdated: '2026-10-08',
  appName: 'Winter Arc',
  /**
   * Public contact address for privacy and account requests. Left unset until
   * the owner chooses one to publish; the pages omit the line while it is null.
   */
  contactEmail: null as string | null,
} as const;
