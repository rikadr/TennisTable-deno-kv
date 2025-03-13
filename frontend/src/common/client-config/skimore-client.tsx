import React from "react";
import skimorelogo from "../img/client-logo/skimore.jpg";
import { ClientConfig } from "./get-client-config";

export class SkimoreClient extends ClientConfig {
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
