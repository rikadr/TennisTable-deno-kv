import { TournamentConfig } from "../event-store/projectors/tournaments-projector";
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
    return this.getTournaments().find((t) => t.id === id);
  }

  #getTournaments(): Tournament[] {
    const allTournamentDbs = this.#getAllTournamentDbs();
    return allTournamentDbs.map(this.#initTournament.bind(this));
  }

  /** Merges event-sourced tournaments with legacy config-based tournaments (config tournaments are overridden by event-sourced ones with the same ID) */
  #getAllTournamentDbs(): TournamentDB[] {
    const eventSourcedConfigs = this.parent.eventStore.tournamentsProjector.getTournamentConfigs();
    const eventSourcedIds = new Set(eventSourcedConfigs.map((t) => t.id));

    // Legacy config tournaments that are NOT overridden by event-sourced ones
    const legacyTournaments = this.parent.client.tournaments.filter((t) => !eventSourcedIds.has(t.id));

    // Convert event-sourced configs to TournamentDB shape
    const eventSourcedTournaments: TournamentDB[] = eventSourcedConfigs.map(this.#configToTournamentDb);

    return [...legacyTournaments, ...eventSourcedTournaments];
  }

  #configToTournamentDb(config: TournamentConfig): TournamentDB {
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      startDate: config.startDate,
      groupPlay: config.groupPlay,
      signedUp: [],
      playerOrder: config.playerOrder,
    };
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
