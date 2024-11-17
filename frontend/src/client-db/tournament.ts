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
    // "Test 1",
    // "Test 2",
    // "Test 3",
    // "Test 4",
    // "Test 5",
    // "Test 6",
    // "Test 7",
    // "Test 8",
    // "Test 9",
    // "Test 10",
    // "Test 11",
    // "Test 12",
    // "Test 13",
    // "Test 14",
    // "Test 15",
    // "Test 16",
    // "Test 17",
    // "Test 18",
    // "Test 19",
    // "Test 20",
    // "Test 21",
    // "Test 22",
    // "Test 23",
    // "Test 24",
    // "Test 25",
    // "Test 26",
    // "Test 27",
    // "Test 28",
    // "Test 29",
    // "Test 30",
    // "Test 31",
    // "Test 32",
    // "Test 33",
    // "Test 34",
    // "Test 35",
    // "Test 36",
    // "Test 37",
    // "Test 38",
    // "Test 39",
    // "Test 40",
    // "Test 41",
    // "Test 42",
    // "Test 43",
    // "Test 44",
    // "Test 45",
    // "Test 46",
    // "Test 47",
    // "Test 48",
    // "Test 49",
    // "Test 50",
    // "Test 51",
    // "Test 52",
    // "Test 53",
    // "Test 54",
    // "Test 55",
    // "Test 56",
    // "Test 57",
    // "Test 58",
    // "Test 59",
    // "Test 60",
    // "Test 61",
    // "Test 62",
    // "Test 63",
    // "Test 64",
    // "Test 65",
    // "Test 66",
    // "Test 67",
    // "Test 68",
    // "Test 69",
    // "Test 70",
    // "Test 71",
    // "Test 72",
    // "Test 73",
    // "Test 74",
    // "Test 75",
    // "Test 76",
    // "Test 77",
    // "Test 78",
    // "Test 79",
    // "Test 80",
    // "Test 81",
    // "Test 82",
    // "Test 83",
    // "Test 84",
    // "Test 85",
    // "Test 86",
    // "Test 87",
    // "Test 88",
    // "Test 89",
    // "Test 90",
    // "Test 91",
    // "Test 92",
    // "Test 93",
    // "Test 94",
    // "Test 95",
    // "Test 96",
    // "Test 97",
    // "Test 98",
    // "Test 99",
    // "Test 100",
    // "Test 101",
    // "Test 102",
    // "Test 103",
    // "Test 104",
    // "Test 105",
    // "Test 106",
    // "Test 107",
    // "Test 108",
    // "Test 109",
    // "Test 110",
    // "Test 111",
    // "Test 112",
    // "Test 113",
    // "Test 114",
    // "Test 115",
    // "Test 116",
    // "Test 117",
    // "Test 118",
    // "Test 119",
    // "Test 120",
    // "Test 121",
    // "Test 122",
    // "Test 123",
    // "Test 124",
    // "Test 125",
    // "Test 126",
    // "Test 127",
    // "Test 128",
    // "Test 129",
    // "Test 130",
    // "Test 131",
    // "Test 132",
    // "Test 133",
    // "Test 134",
    // "Test 135",
    // "Test 136",
    // "Test 137",
    // "Test 138",
    // "Test 139",
    // "Test 140",
    // "Test 141",
    // "Test 142",
    // "Test 143",
    // "Test 144",
    // "Test 145",
    // "Test 146",
    // "Test 147",
    // "Test 148",
    // "Test 149",
    // "Test 150",
    // "Test 151",
    // "Test 152",
    // "Test 153",
    // "Test 154",
    // "Test 155",
    // "Test 156",
    // "Test 157",
    // "Test 158",
    // "Test 159",
    // "Test 160",
    // "Test 161",
    // "Test 162",
    // "Test 163",
    // "Test 164",
    // "Test 165",
    // "Test 166",
    // "Test 167",
    // "Test 168",
    // "Test 169",
    // "Test 170",
    // "Test 171",
    // "Test 172",
    // "Test 173",
    // "Test 174",
    // "Test 175",
    // "Test 176",
    // "Test 177",
    // "Test 178",
    // "Test 179",
    // "Test 180",
    // "Test 181",
    // "Test 182",
    // "Test 183",
    // "Test 184",
    // "Test 185",
    // "Test 186",
    // "Test 187",
    // "Test 188",
    // "Test 189",
    // "Test 190",
    // "Test 191",
    // "Test 192",
    // "Test 193",
    // "Test 194",
    // "Test 195",
    // "Test 196",
    // "Test 197",
    // "Test 198",
    // "Test 199",
    // "Test 200",
  ],
  skippedGames: [],
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
