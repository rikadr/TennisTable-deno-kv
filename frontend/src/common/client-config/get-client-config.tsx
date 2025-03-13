import React from "react";
import { SkimoreClient } from "./skimore-client";

export function getClientConfig() {
  return ClientConfig.create();
}

export class ClientConfig {
  name: string;
  logo: React.ReactElement;
  snow: boolean;

  protected constructor(data: { name: string; logo: React.ReactElement; snow?: boolean }) {
    this.name = data.name;
    this.logo = data.logo;
    this.snow = data.snow ?? false;
  }

  public static create() {
    const clientName = process.env.REACT_APP_CLIENT;

    switch (clientName) {
      case "skimore":
        return new SkimoreClient();
      default:
        return ClientConfig.guest();
    }
  }

  public static guest() {
    return new ClientConfig({
      name: "guest",
      logo: (
        <div className="py-4 px-6 bg-primary-background hover:bg-primary-background/70  rounded-full">
          Tennis🏆💔Table
        </div>
      ),
      snow: false,
    });
  }
}
