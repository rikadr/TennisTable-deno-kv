import { useLocalStorage } from "usehooks-ts";
import { getClientConfig, Theme } from "../client/client-config/get-client-config";
import { OVERRIDE_THEME_KEY } from "../wrappers/theme-provider";

export const SettingsPage: React.FC = () => {
  const { theme } = getClientConfig();

  const [overrideTheme, setOverrideTheme] = useLocalStorage(OVERRIDE_THEME_KEY, "");

  let themeToUse: string = theme;
  if (overrideTheme) {
    themeToUse = overrideTheme;
  }

  return (
    <div className="text-primary-text">
      <h1>Settings</h1>
      <h3>Theme</h3>
      <p>Client theme: {theme} </p>
      <h3>Override theme</h3>
      <select
        className="bg-secondary-background text-secondary-text"
        onChange={(e) => {
          setOverrideTheme(e.target.value);
        }}
        value={themeToUse}
      >
        {["No override", ...Object.values(Theme)].map((theme) => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </select>

      <div className="flex gap-2 m-10">
        <div className="bg-primary-background text-primary-text ring ring-primary-text p-4">Primary</div>
        <div className="bg-secondary-background text-secondary-text ring ring-secondary-text p-4">Secondary</div>
        <div className="bg-tertiary-background text-tertiary-text ring ring-tertiary-text p-4">Tertiary</div>
      </div>
    </div>
  );
};
