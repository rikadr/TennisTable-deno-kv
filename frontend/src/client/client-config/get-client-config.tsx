import React from "react";
import { SkimoreClient } from "./clients/skimore-client";
import { GuestClient } from "./clients/guest-client";
import { OptioClient } from "./clients/optio-client";
import { TournamentDB } from "../client-db/types";
import { LocalDevClient } from "./clients/local-dev-client";

export abstract class ClientConfig {
  id: string | undefined;
  name: string;
  logo: React.ReactElement;
  snow: boolean;
  title: string;
  favicon: string;
  tournaments: TournamentDB[];

  protected constructor(data: {
    id?: string;
    name: string;
    logo: React.ReactElement;
    snow?: boolean;
    title: string;
    favicon: string;
    tournaments: TournamentDB[];
  }) {
    this.id = data.id;
    this.name = data.name;
    this.logo = data.logo;
    this.snow = data.snow ?? false;
    this.title = data.title;
    this.favicon = data.favicon;
    this.tournaments = data.tournaments;
  }
}

export function getClientConfig() {
  const clientName = process.env.REACT_APP_CLIENT;

  switch (clientName) {
    case "local":
      return new LocalDevClient();
    case "skimore":
      return new SkimoreClient();
    case "optio":
      return new OptioClient();
    default:
      return new GuestClient();
  }
}
