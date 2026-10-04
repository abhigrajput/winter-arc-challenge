/* Winter Arc service worker (§8.13).
 *
 * - Offline shell for /today: network-first, last good copy served offline.
 *   The copy is dropped as soon as a navigation lands on /login, so a signed-out
 *   device does not keep someone's checklist around.
 * - Immutable Next.js assets (/_next/static/) cache-first, so the shell renders.
 * - Push: shows the notification; a click focuses an open window or opens the URL.
 */

const VERSION = 'v1';
const SHELL_CACHE = `wa-shell-${VERSION}`;
const ASSET_CACHE = `wa-assets-${VERSION}`;
const SHELL_URL = '/today';

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Winter Arc</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#0a0c10;color:#e5e7eb;
font:15px/1.5 system-ui,sans-serif;padding:24px;text-align:center}p{color:#9ca3af;margin:.5rem 0 0}</style></head>
<body><main><h1 style="font-size:20px;margin:0">Offline.</h1><p>Open Today once while online and it will load here next time.</p></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE]);
      for (const key of await caches.keys()) {
        if (key.startsWith('wa-') && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request, url));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function navigate(request, url) {
  const isShell = url.pathname === SHELL_URL;
  try {
    const response = await fetch(request);
    const landed = new URL(response.url || request.url);

    if (landed.pathname === '/login') {
      // Signed out (or session expired): forget the cached checklist.
      await caches.delete(SHELL_CACHE);
    } else if (isShell && response.ok && landed.pathname === SHELL_URL) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(SHELL_URL, response.clone());
    }
    return response;
  } catch {
    if (isShell) {
      const cached = await (await caches.open(SHELL_CACHE)).match(SHELL_URL);
      if (cached) return cached;
    }
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Winter Arc';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || SHELL_URL },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || SHELL_URL, self.location.origin);
  // Only ever open our own origin, whatever the payload says.
  const href = target.origin === self.location.origin ? target.href : new URL(SHELL_URL, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== href) await client.navigate(href);
          return;
        }
      }
      await self.clients.openWindow(href);
    })(),
  );
});
