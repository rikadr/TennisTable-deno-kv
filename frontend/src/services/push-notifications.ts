import { getDeviceId } from "./device-id";

/**
 * Client side of Web Push: create/remove the browser's push subscription and
 * keep the server informed. The service worker (public/service-worker.js)
 * shows the incoming notifications.
 */

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  return "Notification" in window ? Notification.permission : null;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  // navigator.serviceWorker.ready resolves when the service worker registered
  // at startup is active — but it hangs forever if that registration failed,
  // so cap the wait instead of hanging the enable flow.
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("The service worker did not become ready. Reload the page and try again.")), 10_000);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  // getRegistration resolves immediately (undefined when nothing registered),
  // unlike .ready — this runs on page load to detect the current state.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** The server's VAPID public key, or null when push is not configured there. */
export async function fetchServerPublicKey(): Promise<string | null> {
  const response = await fetch(`${API_BASE_URL}/push/public-key`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not reach the server (HTTP ${response.status})`);
  const body = (await response.json()) as { publicKey: string };
  return body.publicKey;
}

function base64UrlToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * The full enable flow: ask permission, subscribe in the browser, register on
 * the server. Throws with a user-readable message when a step fails.
 */
export async function subscribeToPushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("This browser does not support push notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow notifications for this site in the browser settings.");
  }

  const publicKey = await fetchServerPublicKey();
  if (!publicKey) {
    throw new Error("Push notifications are not configured on the server.");
  }

  const registration = await getServiceWorkerRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    }));

  const response = await fetch(`${API_BASE_URL}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), deviceId: getDeviceId() }),
  });
  if (!response.ok) {
    // The server never stored it, so do not leave a dangling browser subscription.
    await subscription.unsubscribe().catch(() => undefined);
    throw new Error(`The server rejected the subscription (HTTP ${response.status}).`);
  }
}

/**
 * Remove the subscription. The browser side always gets cleaned up; after
 * that the push service rejects the endpoint, so the server copy dies with it
 * even when the unsubscribe request fails.
 */
export async function unsubscribeFromPushNotifications(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  await fetch(`${API_BASE_URL}/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);

  await subscription.unsubscribe();
}

/** Ask the server to push a test notification to this device. */
export async function sendTestPushNotification(): Promise<void> {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) {
    throw new Error("This device has no push subscription. Enable notifications first.");
  }

  const response = await fetch(`${API_BASE_URL}/push/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `The test notification failed (HTTP ${response.status}).`);
  }
}
