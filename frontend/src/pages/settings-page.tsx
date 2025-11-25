import { useLocalStorage } from "usehooks-ts";
import { getClientConfig, Theme } from "../client/client-config/get-client-config";
import { OVERRIDE_THEME_KEY } from "../wrappers/theme-provider";
import { useState } from "react";

const NO_OVERRIDE = "No override";
const LOCAL_STORAGE_KEY = "tennis-table-events";

export const SettingsPage: React.FC = () => {
  const { theme } = getClientConfig();

  const [overrideTheme, setOverrideTheme] = useLocalStorage(OVERRIDE_THEME_KEY, "");
  const [cacheCleared, setCacheCleared] = useState(false);

  let themeToUse: string = theme;
  if (overrideTheme) {
    themeToUse = overrideTheme;
  }

  const handleClearCache = () => {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setCacheCleared(true);
      // Reload the page to refetch all events
      setTimeout(() => {
        window.location.reload();
      }, 1000);
  };

  const getCacheInfo = () => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!cached) return { count: 0, size: "0" };
      const events = JSON.parse(cached);
      const sizeInKB = (cached.length / 1024 / 8).toFixed(2);
      return { count: events.length, size: sizeInKB };
    } catch {
      return { count: 0, size: "0" };
    }
  };

  const cacheInfo = getCacheInfo();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-primary-background text-primary-text rounded-lg shadow-lg">
        <div className="p-6 border-b border-primary-text/10">
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-sm opacity-70 mt-1">Manage your preferences and application settings</p>
        </div>

        <div className="divide-y divide-primary-text/10">
          {/* Cache Management Section */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-1">Cache Management</h2>
                <p className="text-sm opacity-70 mb-4">
                  Events are cached locally to improve load times. Clear the cache if you experience sync issues.
                </p>
                <div className="bg-secondary-background text-secondary-text rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Cached Events</span>
                    <span className="text-sm font-bold">{cacheInfo.count} events</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache Size</span>
                    <span className="text-sm font-bold">{cacheInfo.size} KB</span>
                  </div>
                </div>
                <button
                  onClick={handleClearCache}
                  className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={cacheCleared}
                >
                  {cacheCleared ? "✅ Cache Cleared - Reloading..." : "🗑️ Clear Cache"}
                </button>
              </div>
            </div>
          </div>

          {/* Theme Settings Section */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-1">Theme Settings</h2>
                <p className="text-sm opacity-70 mb-4">Customize the visual appearance of the application</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Current Theme</label>
                    <div className="bg-secondary-background text-secondary-text rounded-lg p-3">
                      <span className="font-medium">{theme}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Override Theme</label>
                    <select
                      className="w-full bg-secondary-background text-secondary-text rounded-lg p-3 border border-secondary-text/20 focus:outline-none focus:ring-2 focus:ring-secondary-text/50"
                      onChange={(e) => {
                        setOverrideTheme(e.target.value === NO_OVERRIDE ? "" : e.target.value);
                      }}
                      value={themeToUse}
                    >
                      {[NO_OVERRIDE, ...Object.values(Theme)].map((theme) => (
                        <option key={theme} value={theme}>
                          {theme}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs opacity-70 mt-2">
                      Refresh the page or navigate to another page for all theme effects to take effect
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Theme Colors Preview Section */}
          <div className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-1">Theme Colors Preview</h2>
                <p className="text-sm opacity-70 mb-4">Preview the current theme color palette</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div
                    onClick={handleClickColor}
                    className="bg-primary-background text-primary-text border-2 border-primary-text rounded-lg p-6 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="font-semibold mb-1">Primary</div>
                    <div className="text-xs opacity-70">Background & Text</div>
                  </div>
                  <div
                    onClick={handleClickColor}
                    className="bg-secondary-background text-secondary-text border-2 border-secondary-text rounded-lg p-6 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="font-semibold mb-1">Secondary</div>
                    <div className="text-xs opacity-70">Background & Text</div>
                  </div>
                  <div
                    onClick={handleClickColor}
                    className="bg-tertiary-background text-tertiary-text border-2 border-tertiary-text rounded-lg p-6 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <div className="font-semibold mb-1">Tertiary</div>
                    <div className="text-xs opacity-70">Background & Text</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function handleClickColor() {
  window.alert("Why did you click the color box? Its obviously not a button 🤷🏼");
}
