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
    <div className="text-primary-text flex flex-col items-center ">
      <h1>Settings</h1>
      <h3>Theme</h3>
      <p>Client theme: {theme} </p>
      <h3>Override theme</h3>
      <select
        className="bg-secondary-background text-secondary-text w-40 h-10"
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
      <p>(Refresh the page or navigate to another page for all theme effects to take effect) </p>

      <h3 className="mt-10">Theme colors</h3>
      <div className="flex gap-2">
        <div onClick={handleClickColor} className="bg-primary-background text-primary-text ring ring-primary-text p-4">
          Primary
        </div>
        <div
          onClick={handleClickColor}
          className="bg-secondary-background text-secondary-text ring ring-secondary-text p-4"
        >
          Secondary
        </div>
        <div
          onClick={handleClickColor}
          className="bg-tertiary-background text-tertiary-text ring ring-tertiary-text p-4"
        >
          Tertiary
        </div>
      </div>
    </div>
  );
};

function handleClickColor() {
  window.alert("Why did you click the color box? Its obviously not a button 🤷🏼");
}
