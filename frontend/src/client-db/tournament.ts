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

type TournamentWithGames = TournamentDB & {
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
