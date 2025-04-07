import React from "react";
import { getClientConfig, Theme } from "../client/client-config/get-client-config";
import { useLocalStorage } from "usehooks-ts";
import { classNames } from "../common/class-names";

export const OVERRIDE_THEME_KEY = "override-theme";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = getClientConfig();
  const [overrideTheme] = useLocalStorage(OVERRIDE_THEME_KEY, "");

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
