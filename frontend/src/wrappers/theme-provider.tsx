import React from "react";
import { getClientConfig, Theme } from "../client/client-config/get-client-config";
import { useLocalStorage } from "usehooks-ts";

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

  return <div className={"theme-" + themeToUse}>{children}</div>;
};
