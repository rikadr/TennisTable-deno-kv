import { TennisTable } from "../tennis-table";
import { TournamentDB } from "../types";
import { Tournament } from "./tournament";

export class Tournaments {
  private readonly parent: TennisTable;
  private readonly skipIsEnabled: boolean = true; // False for prod
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
    const tournamentDb = this.parent.client.tournaments.find((t) => t.id === id);
    if (!tournamentDb) return;
    return this.#initTournament(tournamentDb);
  }

  #getTournaments(): Tournament[] {
    return this.parent.client.tournaments.map(this.#initTournament.bind(this));
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
    const tournamentIndex = this.parent.client.tournaments.findIndex((t) => t.id === tournamentId);
    this.parent.client.tournaments[tournamentIndex]?.skippedGames.push(skip);
    this.#tournamentsCache = undefined;
  }

  undoSkipGame(skip: TournamentDB["skippedGames"][number], tournamentId: string) {
    if (this.skipIsEnabled === false) {
      window.alert("Ask Rikard to undo the skip 🙏 It's not self serviced yet... "); // TODO: Make self serviced
      return;
    }
    const tournamentIndex = this.parent.client.tournaments.findIndex((t) => t.id === tournamentId);
    if (tournamentIndex !== -1) {
      this.parent.client.tournaments[tournamentIndex].skippedGames = this.parent.client.tournaments[
        tournamentIndex
      ].skippedGames.filter((game) => game.time !== skip.time);
    }
    this.#tournamentsCache = undefined;
  }

  isPendingGame(
    // TODO: Needs update to support group play
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
