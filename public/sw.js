/*
  Temporary "kill switch" service worker.

  Why: Some users still have an old Workbox-based service worker registered at scope '/'
  (from a previous deployment) that can break streaming/range requests and cause videos
  to freeze on the first frame.

  This file exists to ensure the browser can update the SW script at /sw.js.
  On activation it clears caches and unregisters itself.
*/

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        // ignore
      }

      try {
        await self.registration.unregister();
      } catch {
        // ignore
      }

      // Refresh all open tabs so they are no longer controlled by the old SW.
      try {
        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        await Promise.all(
          windowClients.map((client) => {
            try {
              return client.navigate(client.url);
            } catch {
              return undefined;
            }
          })
        );
      } catch {
        // ignore
      }
    })()
  );
});

// No fetch handler: allow normal network behavior.
