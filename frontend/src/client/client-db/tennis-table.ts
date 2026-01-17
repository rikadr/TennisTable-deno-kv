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
  }

  /** Returns list of only active players */
  get players() {
    return this.eventStore.playersProjector.activePlayers;
  }
  get games() {
    return this.eventStore.gamesProjector.games;
  }

  playerName(id: string | undefined | null) {
    if (!id) return "⛔️No id⛔️";
    return this.eventStore.playersProjector.getPlayer(id)?.name ?? `⛔️${id}⛔️`;
  }
}
