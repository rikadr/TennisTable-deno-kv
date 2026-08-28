import { db } from "../db.ts";
import { EventType, EventTypeEnum } from "../event-store/event-types.ts";
import { importVapidKeys, sendPushMessage, VapidKeys } from "./web-push.ts";
import type { PushSubscriptionRecord } from "../db/database.ts";

/**
 * Sends a Web Push notification to every subscribed device when a new event
 * is stored, except the device that posted the event.
 *
 * Configuration (all env):
 * - VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: the key pair, base64url. Generate
 *   with `deno run scripts/generate-vapid-keys.ts`. Without them the service
 *   is disabled and the routes report push as not configured.
 * - VAPID_SUBJECT: contact for push service operators, defaults to a mailto
 *   placeholder.
 *
 * The text is built only from data already inside the event payload — the
 * server stays a thin event store and projects nothing. Events that carry only
 * player ids therefore get a generic text.
 */

export type PushNotificationPayload = {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
  /** In-app path the notification opens. */
  url: string;
};

const NOTIFICATION_TTL_SECONDS = 12 * 60 * 60;

let vapidKeysPromise: Promise<VapidKeys | null> | undefined;

function getVapidSubject(): string {
  return Deno.env.get("VAPID_SUBJECT") ?? "mailto:tennistable@example.com";
}

function loadVapidKeys(): Promise<VapidKeys | null> {
  if (!vapidKeysPromise) {
    vapidKeysPromise = (async () => {
      const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
      const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
      if (!publicKey || !privateKey) {
        return null;
      }
      try {
        return await importVapidKeys(publicKey, privateKey);
      } catch (error) {
        console.error("Invalid VAPID keys, push notifications are disabled:", error);
        return null;
      }
    })();
  }
  return vapidKeysPromise;
}

export function isPushConfigured(): boolean {
  return Boolean(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY"));
}

export function getVapidPublicKey(): string | null {
  return isPushConfigured() ? Deno.env.get("VAPID_PUBLIC_KEY")! : null;
}

/**
 * The notification for one event, or null for events that must not notify:
 * companion events that are posted together with another event in the same
 * user action (a game's score, a tournament's auto-seeded player order).
 */
export function buildEventNotification(event: EventType): PushNotificationPayload | null {
  switch (event.type) {
    case EventTypeEnum.GAME_CREATED:
      return {
        title: "New game 🏓",
        body: "A new game was added to the leaderboard.",
        tag: `game-${event.stream}`,
        url: "/recent-games",
      };
    case EventTypeEnum.GAME_SCORE:
      return null;
    case EventTypeEnum.GAME_DELETED:
      return {
        title: "Game deleted 🗑️",
        body: "A game was removed from the leaderboard.",
        tag: `game-${event.stream}`,
        url: "/recent-games",
      };
    case EventTypeEnum.PLAYER_CREATED:
      return {
        title: "New player 🎉",
        body: `${event.data.name} joined the table.`,
        tag: `player-${event.stream}`,
        url: `/player/${encodeURIComponent(event.data.name)}`,
      };
    case EventTypeEnum.PLAYER_DEACTIVATED:
      return {
        title: "Player deactivated",
        body: "A player was deactivated.",
        tag: `player-${event.stream}`,
        url: "/leader-board",
      };
    case EventTypeEnum.PLAYER_REACTIVATED:
      return {
        title: "Player reactivated",
        body: "A player is back on the leaderboard.",
        tag: `player-${event.stream}`,
        url: "/leader-board",
      };
    case EventTypeEnum.PLAYER_NAME_UPDATED:
      return {
        title: "Player renamed",
        body: `A player is now called ${event.data.updatedName}.`,
        tag: `player-${event.stream}`,
        url: `/player/${encodeURIComponent(event.data.updatedName)}`,
      };
    case EventTypeEnum.TOURNAMENT_CREATED:
      return {
        title: "New tournament 🏆",
        body: `${event.data.name} is open for signup.`,
        tag: `tournament-${event.stream}`,
        url: "/tournament",
      };
    case EventTypeEnum.TOURNAMENT_UPDATED:
      return {
        title: "Tournament updated 🏆",
        body: event.data.name ? `${event.data.name} was updated.` : "A tournament was updated.",
        tag: `tournament-${event.stream}`,
        url: "/tournament",
      };
    case EventTypeEnum.TOURNAMENT_DELETED:
      return {
        title: "Tournament deleted",
        body: "A tournament was deleted.",
        tag: `tournament-${event.stream}`,
        url: "/tournament/list",
      };
    case EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER:
      return null;
    case EventTypeEnum.TOURNAMENT_SIGNUP:
      return {
        title: "Tournament signup 🏆",
        body: "A player signed up for the tournament.",
        tag: `tournament-signup-${event.stream}`,
        url: "/tournament",
      };
    case EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP:
      return {
        title: "Tournament signup cancelled",
        body: "A player cancelled their tournament signup.",
        tag: `tournament-signup-${event.stream}`,
        url: "/tournament",
      };
    case EventTypeEnum.TOURNAMENT_SKIP_GAME:
      return {
        title: "Tournament game skipped",
        body: "A tournament game was decided without play.",
        tag: `tournament-${event.stream}`,
        url: "/tournament",
      };
    case EventTypeEnum.TOURNAMENT_UNDO_SKIP_GAME:
      return {
        title: "Tournament skip undone",
        body: "A skipped tournament game is back in play.",
        tag: `tournament-${event.stream}`,
        url: "/tournament",
      };
    default:
      return null;
  }
}

async function sendToSubscription(
  record: PushSubscriptionRecord,
  payload: string,
  vapid: VapidKeys,
): Promise<void> {
  try {
    const result = await sendPushMessage({
      subscription: record.subscription,
      payload,
      vapid,
      subject: getVapidSubject(),
      ttlSeconds: NOTIFICATION_TTL_SECONDS,
    });

    if (result.subscriptionGone) {
      // The push service says this subscription no longer exists. Drop it.
      await db.deletePushSubscription(record.endpoint);
      return;
    }
    if (!result.ok) {
      console.error(`Push delivery failed (${result.status}) for ${record.endpoint}: ${result.body}`);
    }
  } catch (error) {
    console.error(`Push delivery failed for ${record.endpoint}:`, error);
  }
}

/**
 * Notify every subscribed device about a new event, except the device that
 * posted it. Fire-and-forget: callers do not await this, so it catches all of
 * its own errors.
 */
export function notifyNewEvent(event: EventType, originDeviceId: string | null): void {
  (async () => {
    const vapid = await loadVapidKeys();
    if (!vapid) return;

    const notification = buildEventNotification(event);
    if (!notification) return;

    const subscriptions = await db.getAllPushSubscriptions();
    const recipients = subscriptions.filter(
      (record) => !originDeviceId || record.deviceId !== originDeviceId,
    );
    if (recipients.length === 0) return;

    const payload = JSON.stringify(notification);
    await Promise.all(recipients.map((record) => sendToSubscription(record, payload, vapid)));
  })().catch((error) => {
    console.error("Failed to send push notifications for a new event:", error);
  });
}

/** Send a test notification to one subscription, so a user can verify setup. */
export async function sendTestNotification(
  subscription: PushSubscriptionRecord["subscription"],
): Promise<{ ok: boolean; status: number; subscriptionGone: boolean }> {
  const vapid = await loadVapidKeys();
  if (!vapid) {
    return { ok: false, status: 0, subscriptionGone: false };
  }

  const payload: PushNotificationPayload = {
    title: "Test notification 🔔",
    body: "Push notifications work on this device.",
    tag: "tennis-table-test",
    url: "/settings",
  };

  const result = await sendPushMessage({
    subscription,
    payload: JSON.stringify(payload),
    vapid,
    subject: getVapidSubject(),
    ttlSeconds: 60,
    urgency: "high",
  });
  return { ok: result.ok, status: result.status, subscriptionGone: result.subscriptionGone };
}
