'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once per page load. Production builds only: in `next dev`
 * a caching worker would serve stale chunks and confuse HMR.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch(() => {
        // Not fatal: the app works without it; only offline and push are lost.
      });
  }, []);

  return null;
}
