import { TennisTable } from "../tennis-table";
import { TournamentDB } from "../types";
import { TournamentPrediction } from "./prediction";
import { Tournament } from "./tournament";

export class Tournaments {
  private readonly parent: TennisTable;
  #tournamentsCache: Tournament[] | undefined;

  tournamentPrediction: TournamentPrediction;

  constructor(parent: TennisTable) {
    this.parent = parent;
    this.tournamentPrediction = new TournamentPrediction(this.parent);
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
      this.parent.games.filter((g) => g.playedAt >= tournament.startDate),
      this.parent.eventStore.tournamentsProjector.getTournamentSkippedGames(tournament.id),
      this.parent.eventStore.tournamentsProjector.getTournamentSignups(tournament.id),
    );
  }

  findAllPendingGames(player1: string | null | undefined, player2: string | null | undefined) {
    if (!player1 || !player2) return [];
    return this.getTournaments()
      .map((tournament) => tournament.findPendingGame(player1, player2))
      .filter(isDefined);
  }

  findAllPendingGamesByPlayer(player: string | null | undefined) {
    if (!player) return [];
    return this.getTournaments()
      .map((tournament) => tournament.findPendingGamesByPlayer(player))
      .filter(isDefined);
  }
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
