import { TournamentDB } from "../../client-db/types";
import { ClientConfig, Theme } from "../get-client-config";
import { GuestClient } from "./guest-client";

/** Mapping of old name to new ids */
export const optioPlayers = {
  Rasmus: "fwSr2gbKZ9",
  Simone: "KvYCQupTl9",
  Alexander: "zAZF4oc08J",
  Fooa: "2XQllk6sPY",
  Peder: "OTGhYtvi0M",
  Erling: "ZYZhPub2Eo",
  Oskar: "mBwrdSejAz",
  "Fredrik H": "GLjRK9Ri3j",
  Rikard: "ch3ZaIB2qF",
  Ole: "0BFRJ8XiDS",
  Marius: "nnUvT8lPTH",
  Gina: "UCEYqaBBcK",
  Gustas: "8whk3RdC5f",
  Daniele: "BnKaNft4TF",
  "Ole Anders": "Jf0jHQZ0Z7",
  Kevin: "g5siQrzbun",
  "James 007": "Yb1ITjXe9t",
  "Chakib Youcefi": "fQZwfnr6IL",
  Tor: "LYp7GYa12X",
  "Alejandro 🌮": "seVb5J8bSZ",
  Markus: "3im4v9uUzl",
  Yngve: "Yz7pwV6aCB",
} as const;

export class OptioClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Optio";
  theme = Theme.DEFAULT;
  logo = new GuestClient().logo;
  snow = false;
  title = new GuestClient().title;
  favicon = new GuestClient().favicon;
  tournaments = [optioChristmasTournament];
}

export const optioChristmasTournament: TournamentDB = {
  id: "randomid37",
  name: "Optio Christmas Tournament 2024 🏓🎅🏻",
  description:
    "The social happening of the year, and a long awaited feature!! The first ever tournament hosted by the TennisTable app. Sign up with your player and join the tournament 🚀",
  startDate: 1732613408196, // Nov 26 2024 10:30:08 GMT+0100
  groupPlay: false,
  signedUp: [],
  skippedGames: [{ advancing: optioPlayers.Marius, eliminated: optioPlayers.Erling, time: 1732709055829 }], // Marius advancing, Erling eliminated
  playerOrder: [
    optioPlayers.Rasmus,
    optioPlayers.Simone,
    optioPlayers.Alexander,
    optioPlayers.Fooa,
    optioPlayers.Peder,
    optioPlayers.Erling,
    optioPlayers.Oskar,
    optioPlayers["Fredrik H"],
    optioPlayers.Rikard,
    optioPlayers.Ole,
    optioPlayers.Marius,
    optioPlayers.Gina,
    optioPlayers.Gustas,
    optioPlayers.Daniele,
    optioPlayers["Ole Anders"],
    optioPlayers.Kevin,
    optioPlayers["James 007"],
    optioPlayers["Chakib Youcefi"],
  ],
};
