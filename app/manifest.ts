import type { MetadataRoute } from 'next';

/** Installable PWA (§1, §8.13). Served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Winter Arc',
    short_name: 'Winter Arc',
    description: '90 days. Body, mind, discipline. Tracked.',
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0c10',
    theme_color: '#0a0c10',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
