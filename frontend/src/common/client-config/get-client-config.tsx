import React from "react";
import { SkimoreClient } from "./clients/skimore-client";
import { GuestClient } from "./clients/guest-client";

export abstract class ClientConfig {
  name: string;
  logo: React.ReactElement;
  snow: boolean;
  title: string;
  favicon: string;

  protected constructor(data: {
    name: string;
    logo: React.ReactElement;
    snow?: boolean;
    title: string;
    favicon: string;
  }) {
    this.name = data.name;
    this.logo = data.logo;
    this.snow = data.snow ?? false;
    this.title = data.title;
    this.favicon = data.favicon;
  }
}

export function getClientConfig() {
  const clientName = process.env.REACT_APP_CLIENT;

  switch (clientName) {
    case "skimore":
      return new SkimoreClient();
    default:
      return new GuestClient();
  }
}
