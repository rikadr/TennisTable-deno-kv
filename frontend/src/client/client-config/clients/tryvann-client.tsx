import { TournamentDB } from "../../client-db/types";
import { ClientConfig, Theme } from "../get-client-config";
import { GuestClient } from "./guest-client";

export class TryvannClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Tryvann";
  theme = Theme.DEFAULT;
  logo = new GuestClient().logo;
  snow = false;
  title = "Tryvann - bordtennis";
  favicon = "🏓";
  gameLimitForRanked = 5;
  tournaments = [vinterferie2026, theFirstOfficeChampion];
}

const vinterferie2026: TournamentDB = {
  id: "tryvann_vf2026",
  name: "Vinterferie 2026",
  description:
    "Vinterferieturnering med gruppespill! Alle deltakere deles inn i grupper der alle spiller mot alle. Meld deg pa og bli med!",
  startDate: 1771660800000, // Feb 21 2026 09:00:00 GMT+0100 (Norwegian time)
  groupPlay: true,
  signedUp: [],
};

const theFirstOfficeChampion: TournamentDB = {
  id: "tryvann_foc2026",
  name: "The first office Champion",
  description:
    "The first ever office champion tournament! Group play followed by knockout finals. Sign up and claim your title!",
  startDate: 1771833600000, // Feb 23 2026 09:00:00 GMT+0100 (Norwegian time)
  groupPlay: true,
  signedUp: [],
};
