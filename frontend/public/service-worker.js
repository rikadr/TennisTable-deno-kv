/**
 * Service worker for the Tennis Table PWA.
 *
 * Responsibilities:
 * 1. Make the app installable on Android/desktop (a registered service worker
 *    plus the manifest satisfies the install criteria in every Chrome version).
 * 2. Receive Web Push messages and show them as system notifications, also
 *    when no tab of the app is open.
 * 3. Light offline support: navigations fall back to the last good app shell,
 *    and the content-hashed /static/ bundles are served cache-first (they are
 *    immutable, a new deploy uses new file names).
 *
 * Deliberately NOT cached: /index.html fetched directly (the in-app
 * NewVersionChecker polls it with cache: "no-store" to detect deploys — it
 * must always hit the network), API calls and websockets.
 *
 * The registration URL carries context as query params (see
 * src/services/service-worker-registration.ts):
 *   - apiBaseUrl: the backend base url, used to re-register the push
 *     subscription when the browser rotates it.
 *   - deviceId: this device's id, so the server can skip notifying the device
 *     that posted the event.
 */

const SW_VERSION = "v1";
const SHELL_CACHE = `tennis-table-shell-${SW_VERSION}`;
const STATIC_CACHE = `tennis-table-static-${SW_VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, STATIC_CACHE];
const SHELL_KEY = "/__app-shell__";

const swParams = new URL(self.location.href).searchParams;
const API_BASE_URL = swParams.get("apiBaseUrl") || "";
const DEVICE_ID = swParams.get("deviceId") || "";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith("tennis-table-") && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  // App navigations: network first, cached shell as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put(SHELL_KEY, response.clone());
          }
          return response;
        } catch (error) {
          const cached = await caches.match(SHELL_KEY);
          if (cached) return cached;
          throw error;
        }
      })(),
    );
    return;
  }

  // Content-hashed build assets: immutable, so cache first.
  if (url.origin === self.location.origin && url.pathname.startsWith("/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })(),
    );
    return;
  }

  // Everything else (API, /index.html polls, images, ...) goes straight to the
  // network with default browser behaviour.
});

/**
 * A push message arrives. The payload is JSON built by the server:
 * { title, body, tag, url }. Always show a notification — a silent push burns
 * the subscription's browser quota.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Tennis Table 🏓";
  const options = {
    body: payload.body || "Something happened. Open the app to see it.",
    tag: payload.tag || "tennis-table-event",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          if (client.url !== targetUrl && "navigate" in client) {
            await client.navigate(targetUrl).catch(() => undefined);
          }
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

/**
 * The browser can rotate the push subscription (key change, expiry). Re-create
 * it and tell the server, so notifications keep arriving without the user
 * having to toggle them again.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  const resubscribe = (async () => {
    if (!API_BASE_URL) return;

    const oldSubscription = event.oldSubscription || (await self.registration.pushManager.getSubscription());
    const applicationServerKey = oldSubscription?.options?.applicationServerKey;
    if (!applicationServerKey) return;

    const newSubscription = await self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    await fetch(`${API_BASE_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: newSubscription.toJSON(), deviceId: DEVICE_ID || null }),
    });
  })();

  event.waitUntil(resubscribe.catch((error) => console.error("Push resubscribe failed", error)));
});
