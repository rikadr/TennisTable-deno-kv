import { FutureElo } from "./future-elo";
import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { Simulations } from "./simulations";
import { Tournaments } from "./tournaments/tournaments";
import { getClientConfig } from "../client-config/get-client-config";
import { EventType } from "./event-store/event-types";
import { EventStore } from "./event-store/event-store";
import { IndividualPoints } from "./individual-points";
import { LeaderboardChanges } from "./leaderboard-changes";
import { PlayerOponentDistribution } from "./playerOponentDistribution";
import { Achievements } from "./achievements";
import { Seasons } from "./seasons/seasons";
import { PredictionsHistory } from "./predictions-history";
import { HallOfFame } from "./hall-of-fame";

export class TennisTable {
  // --------------------------------------------------------------------------
  // Data from db
  // --------------------------------------------------------------------------
  readonly events: EventType[];

  // --------------------------------------------------------------------------
  // Client configuration
  // --------------------------------------------------------------------------
  client = getClientConfig();

  // --------------------------------------------------------------------------
  // Event store logic
  // --------------------------------------------------------------------------

  eventStore: EventStore;

  // --------------------------------------------------------------------------
  // Business logic
  // --------------------------------------------------------------------------
  leaderboard: Leaderboard;
  leaderboardChanges: LeaderboardChanges;
  pvp: PVP;
  tournaments: Tournaments;
  simulations: Simulations;
  futureElo: FutureElo;
  individualPoints: IndividualPoints;
  playerOponentDistribution: PlayerOponentDistribution;
  achievements: Achievements;
  seasons: Seasons;
  predictionsHistory: PredictionsHistory;
  hallOfFame: HallOfFame;

  constructor(data: { events: EventType[] }) {
    this.events = data.events;
    this.eventStore = new EventStore(this);

    this.leaderboard = new Leaderboard(this);
    this.leaderboardChanges = new LeaderboardChanges(this);
    this.pvp = new PVP(this);
    this.tournaments = new Tournaments(this);
    this.simulations = new Simulations(this);
    this.futureElo = new FutureElo(this);
    this.individualPoints = new IndividualPoints(this);
    this.playerOponentDistribution = new PlayerOponentDistribution(this);
    this.achievements = new Achievements(this);
    this.seasons = new Seasons(this);
    this.predictionsHistory = new PredictionsHistory(this);
    this.hallOfFame = new HallOfFame(this);
  }

  /** Returns list of only active players */
  get players() {
    return this.eventStore.playersProjector.activePlayers;
  }

  get deactivatedPlayers() {
    return this.eventStore.playersProjector.inactivePlayers;
  }

  /** Returns list of all players (active and inactive) */
  get allPlayers() {
    return this.eventStore.playersProjector.allPlayers;
  }

  get games() {
    return this.eventStore.gamesProjector.games;
  }

  playerName(id: string | undefined | null) {
    if (!id) return "⛔️No id⛔️";
    return this.eventStore.playersProjector.getPlayer(id)?.name ?? `⛔️${id}⛔️`;
  }

  /**
   * Returns a function that checks if a player was active at a given timestamp.
   * Used for ELO calculations - only games where both players are active at the
   * calculation timestamp will be included.
   * @param calculationTimestamp The timestamp to check player activity against (e.g., Date.now() for current leaderboard)
   */
  getHistoricalPlayerFilter(calculationTimestamp: number) {
    return (playerId: string) => {
      return this.eventStore.playersProjector.wasPlayerActiveAt(playerId, calculationTimestamp);
    };
  }
}
