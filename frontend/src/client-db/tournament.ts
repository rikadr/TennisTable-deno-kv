import { TennisTable } from "./tennis-table";
import { TournamentDB } from "./types";

type Game = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: TournamentDB["skippedGames"][number];
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: { layerIndex: number; gameIndex: number; role: "player1" | "player2" };
};

export type TournamentWithGames = TournamentDB & {
  games: {
    // Games per layer
    played: Game[]; // Games that have been played
    pending: Game[]; // Games that can be played now
  }[];
  bracket: Bracket;
};

type Bracket = Partial<Game>[][];

export const mockTournament: TournamentDB = {
  id: "1",
  name: "Optio Christmas tournament 2024 🏓🏆🎅🏻",
  description: "Dette er en testturnering for å teste ut funksjonalitet i TennisTable",

  startDate: 1731524875192, // 13th nov, 20:08
  // startDate: 0,
  signedUp: [
    "Rasmus",
    "Simone",
    "Alexander",
    "Fooa",
    "Peder",
    "Christoffer",
    "Erling",
    "Oskar",
    "Sveinung",
    "Fredrik H",
    "Aksel",
    "Rikard",
    "Anders",
    "Ole",
    "Marius",
    "Tor",
    "Ole Anders",
    "Markus",
    "Yngve",
  ],
  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Rasmus",
    "Simone",
    "Alexander",
    "Fooa",
    "Peder",
    "Christoffer",
    "Erling",
    "Oskar",
    "Sveinung",
    "Fredrik H",
    "Aksel",
    "Rikard",
    "Anders",
    "Ole",
    "Marius",
    "Tor",
    "Ole Anders",
    "Markus",
    "Yngve",
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
    // "Test name 38",
    // "Test name 39",
    // "Test name 40",
    // "Test name 41",
    // "Test name 42",
    // "Test name 43",
    // "Test name 44",
    // "Test name 45",
    // "Test name 46",
    // "Test name 47",
    // "Test name 48",
    // "Test name 49",
    // "Test name 50",
    // "Test name 51",
    // "Test name 52",
    // "Test name 53",
    // "Test name 54",
    // "Test name 55",
    // "Test name 56",
    // "Test name 57",
    // "Test name 58",
    // "Test name 59",
    // "Test name 60",
    // "Test name 61",
    // "Test name 62",
    // "Test name 63",
    // "Test name 64",
    // "Test name 65",
    // "Test name 66",
    // "Test name 67",
    // "Test name 68",
    // "Test name 69",
    // "Test name 70",
    // "Test name 71",
    // "Test name 72",
    // "Test name 73",
    // "Test name 74",
    // "Test name 75",
    // "Test name 76",
    // "Test name 77",
    // "Test name 78",
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
  skippedGames: [{ advancing: "Tor", eliminated: "Ole Anders" }],
};

export class Tournaments {
  private parent: TennisTable;
  private tournaments: TournamentDB[] = []; // Add mock for mock data

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getTournaments(): TournamentWithGames[] {
    return this.tournaments.map((t) => this.getTournament(t));
  }

  getTournament(t: TournamentDB): TournamentWithGames {
    if (t.startDate > Date.now()) {
      return {
        ...t,
        games: [],
        bracket: [],
      };
    }

    // Tournament has started, populate games
    const bracket = this.#getStartingBracketFromPlayerOrder(t.playerOrder || []);
    this.#fillBracketWithGames(bracket, t.startDate);
    console.log(bracket);

    const games: TournamentWithGames["games"] = [];

    for (let layerIndex = 0; layerIndex < bracket.length; layerIndex++) {
      const played: Game[] = [];
      const pending: Game[] = [];
      const layer = bracket[layerIndex];

      for (const game of layer) {
        if (game.player1 && game.player2) {
          // Both player are set
          if (game.winner || game.skipped) {
            // Game is completed
            played.push(game as Game);
          } else {
            // Game is pending
            pending.push(game as Game);
          }
        }
      }
      games.push({ pending, played });
    }

    return {
      ...t,
      games,
      bracket,
    };
  }

  skipGame(skip: TournamentDB["skippedGames"][number]) {
    this.tournaments[0].skippedGames.push(skip);
    console.log(this.tournaments[0].skippedGames);
  }
  undoSkipGame(skip: TournamentDB["skippedGames"][number]) {
    this.tournaments[0].skippedGames = this.tournaments[0].skippedGames.filter(
      (game) => game.advancing !== skip.advancing && game.eliminated !== skip.eliminated,
    );
    console.log(this.tournaments[0].skippedGames);
  }

  #getStartingBracketFromPlayerOrder(playerOrder: string[]): Bracket {
    // Bracket structure
    const layers = Math.ceil(Math.log2(playerOrder.length));
    const byesCount = Math.pow(2, layers) - playerOrder.length;

    // Player groups
    const byes = playerOrder.slice(0, byesCount);
    const qualifiers = playerOrder.slice(byesCount);

    if (qualifiers.length % 2 !== 0) {
      throw new Error("Odd number of qualifiers");
    }

    const bracket: Bracket = [];

    // Create layers of the bracket
    for (let i = 1; i <= layers; i++) {
      const gamesInLayer = Math.pow(2, i - 1);

      // Fill layers with empty games until layer for byes
      if ((byesCount === 0 && i < layers) || (byesCount > 0 && i < layers - 1)) {
        bracket.push(
          Array.from({ length: gamesInLayer }, (_, index) => {
            if (i === 1) {
              return {}; // The Final game
            } else {
              return {
                advanceTo: {
                  layerIndex: i - 2,
                  gameIndex: Math.floor(index / 2),
                  role: index % 2 === 0 ? "player1" : "player2",
                },
              };
            }
          }),
        );
        continue;
      }

      if (byesCount > 0 && i === layers - 1) {
        // Distribute byes
        const layer: Bracket[number] = [];

        // Generate all games in layer and populate with highest ranked players
        for (let ibye = 0; ibye < gamesInLayer; ibye++) {
          const game: Bracket[number][number] = { player1: byes[ibye] };
          if (ibye % 2 === 1) {
            // Odd add to end of list
            layer.push(game);
          } else {
            // Even add first in list
            layer.unshift(game);
          }
        }

        // Distribute remaining byes in bye games
        for (let ibye = gamesInLayer; ibye < byesCount; ibye++) {
          const gameIndex = Math.floor((ibye - gamesInLayer) / 2);
          if (ibye % 2 === 0) {
            // Even is last,
            layer[layer.length - 1 - gameIndex].player2 = byes[ibye];
          } else {
            // Odd is first
            layer[gameIndex].player2 = byes[ibye];
          }
        }

        // Assign advanceTo
        layer.forEach(
          (game, index) =>
            (game.advanceTo = {
              layerIndex: i - 2,
              gameIndex: Math.floor(index / 2),
              role: index % 2 === 0 ? "player1" : "player2",
            }),
        );

        bracket.push(layer);
        continue;
      }

      // Fill layer with empty games
      const layer: Bracket[number] = Array.from({ length: gamesInLayer }, (_, index) => ({
        advanceTo: {
          layerIndex: i - 2,
          gameIndex: Math.floor(index / 2),
          role: index % 2 === 0 ? "player1" : "player2",
        },
      }));

      // Pair qualifiers in games
      const qualifierGames: Bracket[number] = Array.from({ length: qualifiers.length / 2 }, () => ({}));
      for (let iquali = 0; iquali < qualifiers.length; iquali++) {
        const gameIndex = Math.floor(iquali / 2);
        const qualifiersLeft = qualifiers.length - iquali;
        const player = qualifiers[iquali];

        if (qualifiersLeft % 2 === 0) {
          // Even is last
          const flippedIndex = qualifierGames.length - 1 - gameIndex;
          if (iquali < qualifiersLeft) {
            qualifierGames[flippedIndex].player1 = player;
          } else {
            qualifierGames[flippedIndex].player2 = player;
          }
        } else {
          // Odd is first
          if (iquali < qualifiersLeft) {
            qualifierGames[gameIndex].player1 = player;
          } else {
            qualifierGames[gameIndex].player2 = player;
          }
        }
      }

      // Distribute qualifier games to advance to correct bye's oponent
      let missingOponentCount = -1;
      layer.forEach((game) => {
        if (!game.advanceTo) throw new Error("advanceTo not defined");
        const advanceToOponent = bracket[game.advanceTo.layerIndex][game.advanceTo.gameIndex][game.advanceTo.role];
        if (advanceToOponent === undefined) {
          missingOponentCount++;
          if (missingOponentCount >= qualifierGames.length) throw new Error("missingOponentCount is too high");
          const qualifierGame = qualifierGames[missingOponentCount];
          if (!qualifierGame) throw new Error("qualifierGame is undefined");
          game.player1 = qualifierGame.player1;
          game.player2 = qualifierGame.player2;
        }
      });

      bracket.push(layer);
    }

    return bracket;
  }

  #fillBracketWithGames(bracket: Bracket, startTime: number) {
    const games = this.parent.games.filter((game) => game.time > startTime);
    games.forEach((game) => {
      // Stop if winning game has been played
      if (bracket[0][0].winner) return;
      // Check if game is a pending game
      bracket.forEach((layer, layerIndex) =>
        layer.forEach((match) => {
          const gamePlayers = [game.winner, game.loser];
          const matchPlayers = [match.player1, match.player2];
          if (
            match.winner === undefined &&
            match.skipped === undefined &&
            gamePlayers.every((player) => matchPlayers.includes(player))
          ) {
            match.winner = game.winner;
            match.completedAt = game.time;
            if (layerIndex > 0) {
              // if (layerIndex > 0) check can be removed when done debugging. advanceTo should be only undefined for final
              // Advance winner to next match
              if (match.advanceTo === undefined) throw new Error("AdvanceTo not defined");
              const nextMatch = bracket[match.advanceTo.layerIndex][match.advanceTo.gameIndex];
              if (!nextMatch) throw new Error("Next match does not exist");
              if (nextMatch.player1 && nextMatch.player2) throw new Error("Next match already full");
              nextMatch[match.advanceTo.role] = match.winner;
            }
          }
        }),
      );
    });
  }
}

/**
 * Ideas:
 * - Tournament results in player page
 * - Tournament page, with brackets and results
 */
