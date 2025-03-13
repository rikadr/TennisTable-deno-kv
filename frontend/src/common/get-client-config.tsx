import React from "react";
import skimorelogo from "../img/client-logo/skimore.jpg";

export function getClientConfig() {
  return ClientConfig.create();
}

class ClientConfig {
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

class SkimoreClient extends ClientConfig {
  constructor() {
    super({
      name: "skimore",
      logo: (
        <div className="h-full max-w-36 sm:max-w-48 rounded-lg overflow-hidden hover:opacity-60">
          <img src={skimorelogo} alt="skimore logo" />
        </div>
      ),
      snow: true,
    });
  }
}
