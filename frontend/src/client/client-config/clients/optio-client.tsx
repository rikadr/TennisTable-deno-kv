import { TournamentDB } from "../../client-db/types";
import { ClientConfig, Theme } from "../get-client-config";
import { GuestClient } from "./guest-client";

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
    "The social happening of the year, and a long awaited feature!! Sign up with your player and join the tournament 🚀",
  startDate: 1732613408196, // Nov 26 2024 10:30:08 GMT+0100
  groupPlay: false,
  signedUp: [],
  skippedGames: [{ advancing: "gcCBTUmYYT", eliminated: "8FKiTn8ZvP", time: 1732709055829 }], // Marius advancing, Erling eliminated

  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Q5G5GQhUqC", // "Rasmus",
    "8lk8924c0J", // "Simone",
    "FgKA0ySdSE", // "Alexander",
    "V8ou4kR4fO", // "Fooa",
    "wjucZdJbcd", // "Peder",
    "8FKiTn8ZvP", // "Erling",
    "WyoMEi0Vcw", // "Oskar",
    "FhimcFfxFu", // "Fredrik H",
    "iapK9z7xKz", // "Rikard",
    "OEq03Oi7of", // "Ole",
    "gcCBTUmYYT", // "Marius",
    "yDfroTVdNV", // "Gina",
    "TDoP7Fvuqa", // "Gustas",
    "C4i3ATB1xH", // "Daniele",
    "pcVKJJPBfl", // "Ole Anders",
    "5CzDnlhtAb", // "Kevin",
    "FyZc8yzxnY", // "James 007",
    "wopCk0VzJr", // "Chakib Youcefi",
  ],
};
