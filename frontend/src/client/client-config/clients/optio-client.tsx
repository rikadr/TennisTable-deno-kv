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
  Mads: "cTwA5h5Eph",
  Francesco: "m7FzHJvxnc",
  Magnus: "5MYtada4AW",
  Marko: "lMKPVqZFLO",
  Michael: "nbn4DSc5Zj",
} as const;
export class OptioClient implements ClientConfig {
  id = process.env.REACT_APP_CLIENT;
  name = "Optio";
  theme = Theme.DEFAULT;
  logo = new GuestClient().logo;
  snow = false;
  title = new GuestClient().title;
  favicon = new GuestClient().favicon;
  gameLimitForRanked = 25;
}
