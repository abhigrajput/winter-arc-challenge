import type { NextConfig } from 'next';
import { CSP_REPORT_PATH, buildCsp } from './lib/security/csp';

const csp = buildCsp({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://invalid.supabase.co',
  dev: process.env.NODE_ENV !== 'production',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Reporting-Endpoints', value: `csp="${CSP_REPORT_PATH}"` },
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
      {
        // The worker must never be served stale, or an old version lingers.
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
