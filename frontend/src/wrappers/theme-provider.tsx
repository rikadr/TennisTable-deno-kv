import React from "react";
import { getClientConfig, Theme } from "../client/client-config/get-client-config";
import { useLocalStorage } from "usehooks-ts";
import { classNames } from "../common/class-names";

export const OVERRIDE_THEME_KEY = "override-theme";

// Max delay (ms) between the two "S" presses for it to count as a double-tap.
const DOUBLE_TAP_DELAY_MS = 400;

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = getClientConfig();
  const [overrideTheme, setOverrideTheme] = useLocalStorage(OVERRIDE_THEME_KEY, "");

  const lastSPressRef = React.useRef(0);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || event.repeat) {
        return;
      }

      // Ignore key presses while typing in inputs, textareas or editable elements.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      // Ignore when a modifier is held so we don't hijack shortcuts like Cmd/Ctrl+S.
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const now = event.timeStamp;
      if (now - lastSPressRef.current <= DOUBLE_TAP_DELAY_MS) {
        lastSPressRef.current = 0;
        setOverrideTheme((current) => (current === Theme.STEALTH ? "" : Theme.STEALTH));
      } else {
        lastSPressRef.current = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOverrideTheme]);

  let themeToUse: string = theme;
  if (overrideTheme && overrideTheme !== "No override") {
    themeToUse = overrideTheme;
  }

  if (themeToUse === Theme.DEFAULT) {
    return children;
  }

  return (
    <div
      id="headlessui-portal-root"
      className={classNames("theme-" + themeToUse, "bg-theme-image bg-center bg-primary-background")}
      style={{
        backgroundSize: "500px",
      }}
    >
      {children}
    </div>
  );
};
