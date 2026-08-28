import { useState, useSyncExternalStore } from "react";
import {
  canPromptInstall,
  isRunningStandalone,
  onInstallPromptChange,
  promptInstall,
} from "../../services/install-prompt";

/**
 * Settings section that offers the browser's install prompt when available,
 * and otherwise explains how to install the app manually.
 */
export const InstallAppSection: React.FC = () => {
  const canInstall = useSyncExternalStore(onInstallPromptChange, canPromptInstall);
  const [installed, setInstalled] = useState(false);

  const standalone = isRunningStandalone();

  async function handleInstall() {
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setInstalled(true);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-1">Install app</h2>
          <p className="text-sm opacity-70 mb-4">
            Install Tennis Table on your device for a full screen app with its own icon.
          </p>

          {standalone || installed ? (
            <p className="text-sm font-medium">✅ The app is installed on this device.</p>
          ) : canInstall ? (
            <button
              onClick={handleInstall}
              className="bg-secondary-background text-secondary-text hover:bg-secondary-background/70 py-2 px-4 rounded-lg transition-colors"
            >
              📱 Install app
            </button>
          ) : (
            <div className="text-sm opacity-70 space-y-1">
              <p>Install from the browser menu:</p>
              <p>
                <span className="font-medium">Android (Chrome):</span> menu ⋮ → "Add to Home screen" → "Install".
              </p>
              <p>
                <span className="font-medium">iPhone/iPad (Safari):</span> share → "Add to Home Screen".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
