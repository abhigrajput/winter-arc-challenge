/** Shared facts for /privacy and /terms. Update LAST_UPDATED when either changes. */
export const LEGAL = {
  lastUpdated: '2026-10-13',
  appName: 'Winter Arc',
  /** Public contact address for privacy and account requests. */
  contactEmail: 'abhigrajput05@gmail.com' as string | null,
  /**
   * Grievance officer under India's Digital Personal Data Protection Act, 2023.
   * The name is optional: when null, the page lists the role and address only.
   */
  grievanceOfficer: { name: null as string | null, email: 'abhigrajput05@gmail.com' },
} as const;
