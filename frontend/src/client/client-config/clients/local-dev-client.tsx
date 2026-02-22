import { ClientConfig } from "../get-client-config";
import { GuestClient } from "./guest-client";

export class LocalDevClient implements ClientConfig {
  id = new GuestClient().id;
  name = "Local dev";
  theme = new GuestClient().theme;
  logo = new GuestClient().logo;
  snow = new GuestClient().snow;
  title = new GuestClient().title;
  favicon = new GuestClient().favicon;
  gameLimitForRanked = new GuestClient().gameLimitForRanked;
}
