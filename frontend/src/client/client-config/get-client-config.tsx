import React from "react";
import { SkimoreClient } from "./clients/skimore-client";
import { GuestClient } from "./clients/guest-client";
import { OptioClient } from "./clients/optio-client";
import { TournamentDB } from "../client-db/types";
import { LocalDevClient } from "./clients/local-dev-client";
import { OVERRIDE_THEME_KEY } from "../../wrappers/theme-provider";
import { AsplanViakClient } from "./clients/asplan-viak-client";

export abstract class ClientConfig {
  id: string | undefined;
  name: string;
  theme: Theme;
  logo: React.ReactElement;
  snow: boolean;
  title: string;
  favicon: string;
  gameLimitForRanked: number;
  tournaments: TournamentDB[];

  protected constructor(data: {
    id?: string;
    name: string;
    theme: Theme;
    logo: React.ReactElement;
    snow?: boolean;
    title: string;
    favicon: string;
    gameLimitForRanked: number;
    tournaments: TournamentDB[];
  }) {
    this.id = data.id;
    this.name = data.name;
    this.theme = data.theme;
    this.logo = data.logo;
    this.snow = data.snow ?? false;
    this.title = data.title;
    this.favicon = data.favicon;
    this.gameLimitForRanked = data.gameLimitForRanked;
    this.tournaments = data.tournaments;
  }
}

export function getClientConfig() {
  const clientName = process.env.REACT_APP_CLIENT;

  switch (clientName) {
    case "local":
      return new LocalDevClient();
    case "optio":
      return new OptioClient();
    case "skimore":
      return new SkimoreClient();
    case "asplanviak":
      return new AsplanViakClient();
    default:
      return new GuestClient();
  }
}

export enum Theme {
  DEFAULT = "default",
  HALLOWEEN = "halloween",
  EASTER = "easter",
  CLIENT_SKIMORE = "skimore",
  CLIENT_ASPLAN_VIAK = "asplanviak",
}

export function themeOrOverrideTheme(theme: Theme): Theme {
  const overrideTheme = window.localStorage.getItem(OVERRIDE_THEME_KEY)?.replaceAll('"', "");
  if (overrideTheme) {
    return overrideTheme as Theme;
  }

  return theme;
}
