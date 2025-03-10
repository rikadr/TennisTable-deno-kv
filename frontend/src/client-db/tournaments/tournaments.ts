import { TennisTable } from "../tennis-table";
import { TournamentDB } from "../types";
import { Tournament } from "./tournament";

export const optioEasterTournament: TournamentDB = {
  id: "randomid38",
  // name: "Optio Easter Tournament 2025 🐣💛",
  name: "Test group play tournament",
  description: "This is a test tournament just to try out the group play feature",
  startDate: 1741535352817, // 1741535352817,
  groupPlay: true,
  signedUp: [],
  skippedGames: [],
  playerOrder: [
    "Rasmus",
    "Fooa",
    "Alexander",
    "Simone",
    "Peder",
    "Christoffer",
    "Daniel",
    "Rikard",
    "Oskar",
    "Erling",
    "Bendik",
    "Sveinung",
    "Axel",
    "Fredrik H",
    "Marius",
    "Ole",
    "Anders",
    // "Gustas",
    // "Alejandro 🌮",
    // "Ole Anders",
    // "Vlad",
    // "Daniele",
    // "Kevin",
    // "James 007",
    // "Chakib Youcefi",
    // "Test name 1",
    // "Test name 2",
    // "Test name 3",
    // "Test name 4",
    // "Test name 5",
    // "Test name 6",
    // "Test name 7",
    // "Test name 8",
    // "Test name 9",
    // "Test name 10",
    // "Test name 11",
    // "Test name 12",
    // "Test name 13",
    // "Test name 14",
    // "Test name 15",
    // "Test name 16",
    // "Test name 17",
    // "Test name 18",
    // "Test name 19",
    // "Test name 20",
    // "Test name 21",
    // "Test name 22",
    // "Test name 23",
    // "Test name 24",
    // "Test name 25",
    // "Test name 26",
    // "Test name 27",
    // "Test name 28",
    // "Test name 29",
    // "Test name 30",
    // "Test name 31",
    // "Test name 32",
    // "Test name 33",
    // "Test name 34",
    // "Test name 35",
    // "Test name 36",
    // "Test name 37",
  ],
};

export const optioChristmasTournament: TournamentDB = {
  id: "randomid37",
  name: "Optio Christmas Tournament 2024 🏓🎅🏻",
  description:
    "The social happening of the year, and a long awaited feature!! Sign up with your player and join the tournament 🚀",
  startDate: 1732613408196, // Nov 26 2024 10:30:08 GMT+0100
  groupPlay: false,
  signedUp: [],
  skippedGames: [{ advancing: "Marius", eliminated: "Erling", time: 1732709055829 }],

  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Rasmus",
    "Simone",
    "Alexander",
    "Fooa",
    "Peder",
    "Erling",
    "Oskar",
    "Fredrik H",
    "Rikard",
    "Ole",
    "Marius",
    "Gina",
    "Gustas",
    "Daniele",
    "Ole Anders",
    "Kevin",
    "James 007",
    "Chakib Youcefi",
  ],
};

export const mockTournament2: TournamentDB = {
  id: "2",
  name: "Test big numbers",
  description: "Dette er en testturnering for å teste ut funksjonalitet i TennisTable",

  startDate: 1731524875192, // 13th nov, 20:08
  // startDate: 0,
  groupPlay: false,
  signedUp: [],
  skippedGames: [],

  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Test name 1",
    "Test name 2",
    "Test name 3",
    "Test name 4",
    "Test name 5",
    "Test name 6",
    "Test name 7",
    "Test name 8",
    "Test name 9",
    "Test name 10",
    "Test name 11",
    "Test name 12",
    "Test name 13",
    "Test name 14",
    "Test name 15",
    "Test name 16",
    "Test name 17",
    "Test name 18",
    "Test name 19",
    "Test name 20",
    "Test name 21",
    "Test name 22",
    "Test name 23",
    "Test name 24",
    "Test name 25",
    "Test name 26",
    "Test name 27",
    "Test name 28",
    "Test name 29",
    "Test name 30",
    "Test name 31",
    "Test name 32",
    "Test name 33",
    "Test name 34",
    "Test name 35",
    "Test name 36",
    "Test name 37",
    "Test name 38",
    "Test name 39",
    "Test name 40",
    "Test name 41",
    "Test name 42",
    "Test name 43",
    "Test name 44",
    "Test name 45",
    "Test name 46",
    "Test name 47",
    "Test name 48",
    "Test name 49",
    "Test name 50",
    "Test name 51",
    "Test name 52",
    "Test name 53",
    "Test name 54",
    "Test name 55",
    "Test name 56",
    "Test name 57",
    "Test name 58",
    "Test name 59",
    "Test name 60",
    "Test name 61",
    "Test name 62",
    "Test name 63",
    "Test name 64",
    "Test name 65",
    "Test name 66",
    "Test name 67",
    "Test name 68",
    "Test name 69",
    "Test name 70",
    "Test name 71",
    "Test name 72",
    "Test name 73",
    "Test name 74",
    "Test name 75",
    "Test name 76",
    "Test name 77",
    "Test name 78",
    // "Test name 79",
    // "Test name 80",
    // "Test name 81",
    // "Test name 82",
    // "Test name 83",
    // "Test name 84",
    // "Test name 85",
    // "Test name 86",
    // "Test name 87",
    // "Test name 88",
    // "Test name 89",
    // "Test name 90",
    // "Test name 91",
    // "Test name 92",
    // "Test name 93",
    // "Test name 94",
    // "Test name 95",
    // "Test name 96",
    // "Test name 97",
    // "Test name 98",
    // "Test name 99",
    // "Test name 100",
    // "Test name 101",
    // "Test name 102",
    // "Test name 103",
    // "Test name 104",
    // "Test name 105",
    // "Test name 106",
    // "Test name 107",
    // "Test name 108",
    // "Test name 109",
    // "Test name 110",
    // "Test name 111",
    // "Test name 112",
    // "Test name 113",
    // "Test name 114",
    // "Test name 115",
    // "Test name 116",
    // "Test name 117",
    // "Test name 118",
    // "Test name 119",
    // "Test name 120",
    // "Test name 121",
    // "Test name 122",
    // "Test name 123",
    // "Test name 124",
    // "Test name 125",
    // "Test name 126",
    // "Test name 127",
    // "Test name 128",
    // "Test name 129",
    // "Test name 130",
    // "Test name 131",
    // "Test name 132",
    // "Test name 133",
    // "Test name 134",
    // "Test name 135",
    // "Test name 136",
    // "Test name 137",
    // "Test name 138",
    // "Test name 139",
    // "Test name 140",
    // "Test name 141",
    // "Test name 142",
    // "Test name 143",
    // "Test name 144",
    // "Test name 145",
    // "Test name 146",
    // "Test name 147",
    // "Test name 148",
    // "Test name 149",
    // "Test name 150",
    // "Test name 151",
    // "Test name 152",
    // "Test name 153",
    // "Test name 154",
    // "Test name 155",
    // "Test name 156",
    // "Test name 157",
    // "Test name 158",
    // "Test name 159",
    // "Test name 160",
    // "Test name 161",
    // "Test name 162",
    // "Test name 163",
    // "Test name 164",
    // "Test name 165",
    // "Test name 166",
    // "Test name 167",
    // "Test name 168",
    // "Test name 169",
    // "Test name 170",
    // "Test name 171",
    // "Test name 172",
    // "Test name 173",
    // "Test name 174",
    // "Test name 175",
    // "Test name 176",
    // "Test name 177",
    // "Test name 178",
    // "Test name 179",
    // "Test name 180",
    // "Test name 181",
    // "Test name 182",
    // "Test name 183",
    // "Test name 184",
    // "Test name 185",
    // "Test name 186",
    // "Test name 187",
    // "Test name 188",
    // "Test name 189",
    // "Test name 190",
    // "Test name 191",
    // "Test name 192",
    // "Test name 193",
    // "Test name 194",
    // "Test name 195",
    // "Test name 196",
    // "Test name 197",
    // "Test name 198",
    // "Test name 199",
    // "Test name 200",
  ],
};

export class Tournaments {
  private readonly parent: TennisTable;
  private readonly skipIsEnabled: boolean = true; // False for prod
  readonly tournaments: TournamentDB[] = [optioChristmasTournament, optioEasterTournament]; // Add mock for mock data -> mockTournament1, mockTournament2
  #tournamentsCache: Tournament[] | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  clearTournamentCache() {
    this.#tournamentsCache = undefined;
  }

  getTournaments(): Tournament[] {
    if (this.#tournamentsCache !== undefined) return this.#tournamentsCache;
    const tournaments = this.#getTournaments();
    this.#tournamentsCache = tournaments;
    return tournaments;
  }

  getTournament(id: string | null): Tournament | undefined {
    if (!id) return;
    const tournamentDb = this.tournaments.find((t) => t.id === id);
    if (!tournamentDb) return;
    return this.#initTournament(tournamentDb);
  }

  #getTournaments(): Tournament[] {
    return this.tournaments.map(this.#initTournament.bind(this));
  }

  #initTournament(tournament: TournamentDB): Tournament {
    return new Tournament(
      tournament,
      [...this.parent.games, ...this.parent.futureElo.predictedGames], // Add simulated games too
      this.parent.signedUp.filter((s) => s.tournamentId === tournament.id),
    );
  }

  skipGame(skip: TournamentDB["skippedGames"][number], tournamentId: string) {
    if (this.skipIsEnabled === false) {
      window.alert("Ask Rikard to skip the game 🙏 It's not self serviced yet... "); // TODO: Make self serviced
      return;
    }
    const tournamentIndex = this.tournaments.findIndex((t) => t.id === tournamentId);
    this.tournaments[tournamentIndex]?.skippedGames.push(skip);
    this.#tournamentsCache = undefined;
  }

  undoSkipGame(skip: TournamentDB["skippedGames"][number], tournamentId: string) {
    if (this.skipIsEnabled === false) {
      window.alert("Ask Rikard to undo the skip 🙏 It's not self serviced yet... "); // TODO: Make self serviced
      return;
    }
    const tournamentIndex = this.tournaments.findIndex((t) => t.id === tournamentId);
    if (tournamentIndex !== -1) {
      this.tournaments[tournamentIndex].skippedGames = this.tournaments[tournamentIndex].skippedGames.filter(
        (game) => game.time !== skip.time,
      );
    }
    this.#tournamentsCache = undefined;
  }

  isPendingGame(
    // Needs update on group play
    player1: string | null | undefined,
    player2: string | null | undefined,
  ):
    | {
        tournament: { name: string; id: string };
        layerIndex: number;
        game: { player1: string; player2: string };
      }
    | undefined {
    if (!player1 || !player2) return;
    const players = [player1, player2];

    const tournament = this.getTournaments().find((t) =>
      t.bracket?.bracketGames?.some((layer) =>
        layer.pending.some((game) => players.includes(game.player1) && players.includes(game.player2)),
      ),
    );
    if (!tournament || !tournament.bracket?.bracketGames) return; // remove || !tournament.bracketGames

    const layerIndex = tournament.bracket?.bracketGames.findIndex((layer) =>
      layer.pending.some((game) => players.includes(game.player1) && players.includes(game.player2)),
    );
    if (layerIndex === -1) return;

    const game = tournament.bracket!.bracketGames![layerIndex].pending?.find(
      (game) => players.includes(game.player1) && players.includes(game.player2),
    );
    if (!game) return;

    return {
      tournament: { name: tournament.tournamentDb.name, id: tournament.tournamentDb.id },
      layerIndex,
      game,
    };
  }
}

/**
 * TODOS:
 * - Store skips in db, page to register skip
 */

/**
 * Ideas:
 * - Tournament results in player page
 */
