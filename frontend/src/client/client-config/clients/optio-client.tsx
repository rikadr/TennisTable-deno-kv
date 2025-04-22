import { TournamentDB } from "../../client-db/types";
import { ClientConfig, Theme } from "../get-client-config";
import { GuestClient } from "./guest-client";

export const optioPlayersById = {
  fwSr2gbKZ9: "Rasmus",
  KvYCQupTl9: "Simone",
  zAZF4oc08J: "Alexander",
  "2XQllk6sPY": "Fooa",
  OTGhYtvi0M: "Peder",
  ZYZhPub2Eo: "Erling",
  mBwrdSejAz: "Oskar",
  GLjRK9Ri3j: "Fredrik H",
  ch3ZaIB2qF: "Rikard",
  "0BFRJ8XiDS": "Ole",
  nnUvT8lPTH: "Marius",
  UCEYqaBBcK: "Gina",
  "8whk3RdC5f": "Gustas",
  BnKaNft4TF: "Daniele",
  Jf0jHQZ0Z7: "Ole Anders",
  g5siQrzbun: "Kevin",
  Yb1ITjXe9t: "James 007",
  fQZwfnr6IL: "Chakib Youcefi",
  LYp7GYa12X: "Tor",
  seVb5J8bSZ: "Alejandro 🌮",
  "3im4v9uUzl": "Markus",
  Yz7pwV6aCB: "Yngve",
  O6Y4yMY0eY: "Anders",
  onn7WJqr9x: "Axel",
  "5r1IH1RR3D": "Christoffer",
  o8GLyAvjYV: "Daniel",
  xz8yoKjeSp: "Sveinung",
  XVUtdsdCFj: "Bendik",
};

export const optioPlayersByName = {
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
  Anders: "O6Y4yMY0eY",
  Axel: "onn7WJqr9x",
  Christoffer: "5r1IH1RR3D",
  Daniel: "o8GLyAvjYV",
  Sveinung: "xz8yoKjeSp",
  Bendik: "XVUtdsdCFj",
} as const;
export class OptioClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Optio";
  theme = Theme.DEFAULT;
  logo = new GuestClient().logo;
  snow = false;
  title = new GuestClient().title;
  favicon = new GuestClient().favicon;
  gameLimitForRanked = 10;
  tournaments = [optioChristmasTournament, optioEasterTournament];
}

const optioEasterTournament: TournamentDB = {
  id: "bwzIXeHSRF",
  name: "Easter Tournament 2025 🏓🐣",
  description:
    "Now with group play! All participants are first divided into groups where everyone plays everyone. Each game you score tournament-points to determin what players advance to the tournament finals. Sign up with your player and join the tournament 🚀",
  startDate: 1744012800000, // "Apr 7 2025 09:00:00 GMT+0100" 10:00 Norwegian time
  groupPlay: true,
  signedUp: [],
  skippedGames: [{ advancing: optioPlayersByName.Axel, eliminated: optioPlayersByName.Ole, time: 1745324560434 }],
  playerOrder: [
    optioPlayersByName.Rasmus,
    optioPlayersByName.Fooa,
    optioPlayersByName.Alexander,
    optioPlayersByName.Simone,
    optioPlayersByName.Peder,
    optioPlayersByName.Christoffer,
    optioPlayersByName.Oskar,
    optioPlayersByName.Rikard,
    optioPlayersByName.Ole,
    optioPlayersByName.Axel,
    optioPlayersByName.Bendik,
    optioPlayersByName["Fredrik H"],
    optioPlayersByName.Daniel,
    optioPlayersByName.Marius,
    optioPlayersByName.Anders,
    optioPlayersByName["Alejandro 🌮"],
    optioPlayersByName.Gustas,
  ],
};
const optioChristmasTournament: TournamentDB = {
  id: "randomid37",
  name: "Optio Christmas Tournament 2024 🏓🎅🏻",
  description:
    "The social happening of the year, and a long awaited feature!! The first ever tournament hosted by the TennisTable app. Sign up with your player and join the tournament 🚀",
  startDate: 1732613408196, // Nov 26 2024 10:30:08 GMT+0100
  groupPlay: false,
  signedUp: [],
  skippedGames: [{ advancing: optioPlayersByName.Marius, eliminated: optioPlayersByName.Erling, time: 1732709055829 }],
  playerOrder: [
    optioPlayersByName.Rasmus,
    optioPlayersByName.Simone,
    optioPlayersByName.Alexander,
    optioPlayersByName.Fooa,
    optioPlayersByName.Peder,
    optioPlayersByName.Erling,
    optioPlayersByName.Oskar,
    optioPlayersByName["Fredrik H"],
    optioPlayersByName.Rikard,
    optioPlayersByName.Ole,
    optioPlayersByName.Marius,
    optioPlayersByName.Gina,
    optioPlayersByName.Gustas,
    optioPlayersByName.Daniele,
    optioPlayersByName["Ole Anders"],
    optioPlayersByName.Kevin,
    optioPlayersByName["James 007"],
    optioPlayersByName["Chakib Youcefi"],
  ],
};
