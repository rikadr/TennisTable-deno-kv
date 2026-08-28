import { usePushNotifications } from "../../hooks/use-push-notifications";

/**
 * Settings section to turn Web Push notifications on or off for this device,
 * and to send a test notification.
 */
export const PushNotificationsSection: React.FC = () => {
  const { status, busy, error, testSent, enable, disable, sendTest } = usePushNotifications();

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-1">Push notifications</h2>
          <p className="text-sm opacity-70 mb-4">
            Get a notification on this device when someone adds a game, a player joins, or a tournament changes.
            Events you post from this device do not notify you.
          </p>

          {status === "loading" && <p className="text-sm opacity-70">Checking notification status…</p>}

          {status === "unsupported" && (
            <div className="text-sm opacity-70 space-y-1">
              <p>This browser does not support push notifications.</p>
              <p>On iPhone/iPad, install the app to the Home Screen first, then enable notifications from there.</p>
            </div>
          )}

          {status === "denied" && (
            <p className="text-sm opacity-70">
              Notifications are blocked for this site. Allow them in the browser's site settings, then reload this
              page.
            </p>
          )}

          {status === "not-configured" && (
            <p className="text-sm opacity-70">The server does not have push notifications configured.</p>
          )}

          {status === "disabled" && (
            <button
              onClick={enable}
              disabled={busy}
              className="bg-secondary-background text-secondary-text hover:bg-secondary-background/70 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? "Enabling…" : "🔔 Enable notifications"}
            </button>
          )}

          {status === "enabled" && (
            <div className="space-y-3">
              <p className="text-sm font-medium">✅ Notifications are enabled on this device.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={sendTest}
                  disabled={busy}
                  className="bg-secondary-background text-secondary-text hover:bg-secondary-background/70 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy ? "Working…" : "Send test notification"}
                </button>
                <button
                  onClick={disable}
                  disabled={busy}
                  className="bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/70 py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Disable notifications
                </button>
              </div>
              {testSent && <p className="text-sm opacity-70">Test sent — it arrives within a few seconds.</p>}
            </div>
          )}

          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
        </div>
      </div>
    </div>
  );
};
