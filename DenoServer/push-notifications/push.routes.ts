import { Router } from "oak";
import { db } from "../db.ts";
import { getVapidPublicKey, isPushConfigured, sendTestNotification } from "./push-notifications.ts";
import { base64UrlDecode } from "./web-push.ts";
import type { PushSubscriptionRecord } from "../db/database.ts";

/**
 * Validate an incoming PushSubscription JSON. Returns the cleaned
 * subscription or null. Strict on the crypto material — junk here would only
 * surface as delivery failures much later.
 */
function parseSubscription(input: unknown): PushSubscriptionRecord["subscription"] | null {
  if (typeof input !== "object" || input === null) return null;
  const candidate = input as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

  const endpoint = candidate.endpoint;
  const p256dh = candidate.keys?.p256dh;
  const auth = candidate.keys?.auth;
  if (typeof endpoint !== "string" || typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) return null;

  try {
    if (base64UrlDecode(p256dh).length !== 65) return null;
    if (base64UrlDecode(auth).length !== 16) return null;
  } catch {
    return null;
  }

  return { endpoint, keys: { p256dh, auth } };
}

function parseDeviceId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (input.length === 0 || input.length > 64) return null;
  return input;
}

export function registerPushRoutes(api: Router) {
  /**
   * The VAPID public key the browser needs to create a push subscription.
   * 404 when the server has no keys — the frontend hides the feature then.
   */
  api.get("/push/public-key", (context) => {
    const publicKey = getVapidPublicKey();
    if (!publicKey) {
      context.response.status = 404;
      context.response.body = { error: "Push notifications are not configured on this server" };
      return;
    }
    context.response.body = { publicKey };
  });

  /**
   * Store (or refresh) a push subscription. Also called by the service worker
   * when the browser rotates the subscription.
   */
  api.post("/push/subscribe", async (context) => {
    const payload = (await context.request.body.json()) as { subscription?: unknown; deviceId?: unknown };

    const subscription = parseSubscription(payload.subscription);
    if (!subscription) {
      context.response.status = 400;
      context.response.body = { error: "Invalid push subscription" };
      return;
    }

    await db.savePushSubscription({
      endpoint: subscription.endpoint,
      deviceId: parseDeviceId(payload.deviceId),
      subscription,
      createdAt: Date.now(),
    });
    context.response.status = 201;
  });

  /**
   * Remove a subscription. Idempotent — unsubscribing twice is fine.
   */
  api.post("/push/unsubscribe", async (context) => {
    const payload = (await context.request.body.json()) as { endpoint?: unknown };
    if (typeof payload.endpoint !== "string") {
      context.response.status = 400;
      context.response.body = { error: "Missing endpoint" };
      return;
    }

    await db.deletePushSubscription(payload.endpoint);
    context.response.status = 200;
    context.response.body = { ok: true };
  });

  /**
   * Send a test notification to the given subscription, so a user can verify
   * the whole pipeline from the settings page.
   */
  api.post("/push/test", async (context) => {
    if (!isPushConfigured()) {
      context.response.status = 404;
      context.response.body = { error: "Push notifications are not configured on this server" };
      return;
    }

    const payload = (await context.request.body.json()) as { subscription?: unknown };
    const subscription = parseSubscription(payload.subscription);
    if (!subscription) {
      context.response.status = 400;
      context.response.body = { error: "Invalid push subscription" };
      return;
    }

    const result = await sendTestNotification(subscription);
    if (result.subscriptionGone) {
      await db.deletePushSubscription(subscription.endpoint);
      context.response.status = 410;
      context.response.body = { error: "The push service rejected the subscription as expired" };
      return;
    }
    if (!result.ok) {
      context.response.status = 502;
      context.response.body = { error: `The push service answered with status ${result.status}` };
      return;
    }
    context.response.body = { ok: true };
  });
}
