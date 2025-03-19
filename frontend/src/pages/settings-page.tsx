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

  console.log({
    theme,
    overrideTheme,
    themeToUse,
  });

  return (
    <div>
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
    </div>
  );
};
