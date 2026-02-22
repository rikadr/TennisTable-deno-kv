import { TournamentConfig } from "../event-store/projectors/tournaments-projector";
import { TennisTable } from "../tennis-table";
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
    const configs = this.parent.eventStore.tournamentsProjector.getTournamentConfigs();
    return configs.map(this.#initTournament.bind(this));
  }

  #initTournament(tournament: TournamentConfig): Tournament {
    return new Tournament(
      tournament,
      this.parent.games.filter((g) => g.playedAt >= tournament.startDate),
      this.parent.eventStore.tournamentsProjector.getTournamentSkippedGames(tournament.id),
      this.parent.eventStore.tournamentsProjector.getTournamentSignups(tournament.id),
    );
  }

  getTournamentsNeedingPlayerOrder() {
    return this.parent.eventStore.tournamentsProjector
      .getTournamentConfigs()
      .filter(
        (config) =>
          config.playerOrder === undefined &&
          config.startDate !== 0 && // Is the case when config is missing
          config.startDate <= Date.now() &&
          this.parent.eventStore.tournamentsProjector.getTournamentSignups(config.id).length > 0,
      );
  }

  buildPlayerOrder(tournamentId: string): string[] {
    const signups = this.parent.eventStore.tournamentsProjector.getTournamentSignups(tournamentId);
    const leaderboard = this.parent.leaderboard.getLeaderboard();

    const rankMap = new Map<string, number>();
    leaderboard.rankedPlayers.forEach((p) => rankMap.set(p.id, p.rank));

    return signups
      .map((s) => s.player)
      .sort((a, b) => {
        const rankA = rankMap.get(a);
        const rankB = rankMap.get(b);
        if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
        if (rankA !== undefined) return -1;
        if (rankB !== undefined) return 1;
        const signupA = signups.find((s) => s.player === a)!.time;
        const signupB = signups.find((s) => s.player === b)!.time;
        return signupA - signupB;
      });
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
