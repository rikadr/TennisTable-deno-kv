import { Tournament, TournamentGame } from "./tournament";

type Bracket = Partial<TournamentGame>[][];

export class TournamentBracket {
  readonly #tournament: Tournament;
  readonly #playerOrder: string[];

  bracket: Bracket;
  bracketGames: {
    // Games per bracket layer
    played: TournamentGame[]; // Completed games
    pending: TournamentGame[]; // Games that can be played now
  }[];
  bracketStarted: number;
  bracketEnded?: number;

  constructor(tournament: Tournament) {
    // Assumes no group play, or that group play has ended
    this.#tournament = tournament;
    if (this.#tournament.groupPlay?.groupPlayEnded !== undefined) {
      this.#playerOrder = this.#tournament.groupPlay.getBracketPlayerOrder() ?? [];
      this.bracketStarted = this.#tournament.groupPlay.groupPlayEnded;
    } else {
      this.#playerOrder = this.#tournament.tournamentDb.playerOrder ?? tournament.signedUp.map((s) => s.player);
      this.bracketStarted = this.#tournament.tournamentDb.startDate;
    }

    this.bracket = this.#getStartingBracket();
    this.#fillBracketWithGames();
    this.bracketGames = this.#calculateBracketGames();
    this.bracketEnded = this.bracket[0]?.[0]?.completedAt;
  }

  get winner() {
    return this.bracket[0]?.[0]?.winner;
  }

  #getStartingBracket(): Bracket {
    const bracket: Bracket = [];

    this.#playerOrder.forEach((player, playerIndex, players) => {
      const layerIndex = Math.floor(Math.log2(Math.max(1, playerIndex)));
      const gamesInLayer = Math.pow(2, layerIndex);

      // Fill layer with empty games
      if (bracket[layerIndex] === undefined) {
        bracket[layerIndex] = Array.from({ length: gamesInLayer }, (_, index) => {
          if (layerIndex === 0) {
            return {}; // The Final game
          } else {
            return {
              advanceTo: {
                layerIndex: layerIndex - 1,
                gameIndex: Math.floor(index / 2),
                role: index % 2 === 0 ? "player1" : "player2",
              },
            };
          }
        });
      }

      // Assign players to the final game
      if (playerIndex < 2) {
        bracket[layerIndex][0][playerIndex === 0 ? "player1" : "player2"] = player;
        return; // Can i return here?
      }
      const oponentIndex = 2 * gamesInLayer - 1 - playerIndex;
      const oponent = players[oponentIndex];
      if (oponent === undefined) throw new Error("oponent is undefined");

      const oponentsMatchIndex = bracket[layerIndex - 1].findIndex(({ player1, player2 }) =>
        [player1, player2].includes(oponent),
      );
      if (oponentsMatchIndex === -1) throw new Error("oponentsMatchIndex not found (-1)");
      const oponentsMatch = bracket[layerIndex - 1][oponentsMatchIndex];
      const oponentRole: keyof TournamentGame = oponentsMatch.player1 === oponent ? "player1" : "player2";

      const newGameIndex = oponentsMatchIndex * 2 + (oponentRole === "player1" ? 0 : 1);
      const newGame = bracket[layerIndex][newGameIndex];

      // Add players to new game
      newGame.player1 = oponent;
      newGame.player2 = player;

      // Remove oponent from oponent game
      oponentsMatch[oponentRole] = undefined;
    });

    return bracket;
  }

  #fillBracketWithGames() {
    const entries = this.#tournament.getRelevantGames(this.bracketStarted);

    entries.forEach((entry) => {
      // eslint-disable-next-line no-loop-func
      this.bracket.forEach((layer, layerIndex) =>
        layer.forEach((match) => {
          if (match.winner || match.player1 === undefined || match.player2 === undefined) {
            // Won (or skipped), or incomplete players
            return;
          }
          const matchPlayers = [match.player1, match.player2];
          const entryPlayers = [entry.player1, entry.player2];
          const entryIsMatch = matchPlayers.every((player) => entryPlayers.includes(player));

          if (entryIsMatch === false) {
            // No match, keep as pending
            return;
          }

          match.winner = entry.game ? entry.game.winner : entry.skip.winner;
          match.completedAt = entry.time; // Not sure how that would affect select item options for skipped games.....
          match.skipped = entry.skip;

          if (layerIndex === 0) {
            // No advanceTo for the final game
            return;
          }

          if (match.advanceTo === undefined) throw new Error("AdvanceTo not defined");
          const nextMatch = this.bracket[match.advanceTo.layerIndex][match.advanceTo.gameIndex];
          if (!nextMatch) throw new Error("Next match does not exist");
          if (nextMatch.player1 && nextMatch.player2) throw new Error("Next match already full");
          nextMatch[match.advanceTo.role] = match.winner;
        }),
      );
    });
  }

  #calculateBracketGames() {
    const games: TournamentBracket["bracketGames"] = [];
    for (let layerIndex = 0; layerIndex < this.bracket.length; layerIndex++) {
      const played: TournamentGame[] = [];
      const pending: TournamentGame[] = [];
      const layer = this.bracket[layerIndex];

      for (const game of layer) {
        if (game.player1 && game.player2) {
          // Both player are set
          if (game.winner || game.skipped) {
            // Game is completed
            played.push(game as TournamentGame);
          } else {
            // Game is pending
            pending.push(game as TournamentGame);
          }
        }
      }
      games.push({ pending, played });
    }
    return games;
  }
}
