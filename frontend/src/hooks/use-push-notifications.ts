import { useCallback, useEffect, useState } from "react";
import {
  fetchServerPublicKey,
  getCurrentPushSubscription,
  getNotificationPermission,
  isPushSupported,
  sendTestPushNotification,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
} from "../services/push-notifications";

export type PushNotificationsStatus =
  | "loading"
  | "unsupported"
  | "denied"
  | "not-configured"
  | "disabled"
  | "enabled";

/**
 * State machine behind the notifications section on the settings page:
 * detects the current situation on mount and exposes the enable / disable /
 * test actions.
 */
export function usePushNotifications() {
  const [status, setStatus] = useState<PushNotificationsStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!isPushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (getNotificationPermission() === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }

      const subscription = await getCurrentPushSubscription().catch(() => null);
      if (cancelled) return;
      if (subscription) {
        setStatus("enabled");
        return;
      }

      // No subscription yet: check whether the server offers push at all.
      try {
        const publicKey = await fetchServerPublicKey();
        if (!cancelled) setStatus(publicKey ? "disabled" : "not-configured");
      } catch {
        // Server unreachable — let the user try, the enable flow reports errors.
        if (!cancelled) setStatus("disabled");
      }
    }

    detect();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPushNotifications();
      setStatus("enabled");
    } catch (enableError) {
      setError((enableError as Error).message);
      if (getNotificationPermission() === "denied") {
        setStatus("denied");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      await unsubscribeFromPushNotifications();
      setStatus("disabled");
    } catch (disableError) {
      setError((disableError as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setError(null);
    setTestSent(false);
    try {
      await sendTestPushNotification();
      setTestSent(true);
    } catch (testError) {
      setError((testError as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  return { status, busy, error, testSent, enable, disable, sendTest };
}
