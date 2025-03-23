import { FutureElo } from "./future-elo";
import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { Simulations } from "./simulations";
import { Tournaments } from "./tournaments/tournaments";
import { ClientDbDTO, Game, Player, SignUpTournament } from "./types";
import { getClientConfig } from "../client-config/get-client-config";
import { EventType } from "./event-store/event-types";
import { EventStore } from "./event-store/event-store";

export class TennisTable {
  isSimulatedState = false;

  // --------------------------------------------------------------------------
  // Data from db
  // --------------------------------------------------------------------------
  readonly players: Player[];
  readonly games: Game[];
  readonly signedUp: SignUpTournament[];
  readonly events: EventType[]; // May need to not be readonly when doing fetching of new events

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
  pvp: PVP;
  tournaments: Tournaments;
  simulations: Simulations;
  futureElo: FutureElo;

  constructor(data: ClientDbDTO & { events: EventType[] }) {
    this.events = data.events;
    this.eventStore = new EventStore(this);

    this.players = this.eventStore.oldTypePlayers;
    this.games = this.eventStore.oldTypeGames;
    this.signedUp = this.eventStore.oldTypeTournamentSignups;

    // this.players = data.players;
    // this.games = data.games;
    // this.signedUp = data.tournament?.signedUp || [];

    this.leaderboard = new Leaderboard(this);
    this.pvp = new PVP(this);
    this.tournaments = new Tournaments(this);
    this.simulations = new Simulations(this);
    this.futureElo = new FutureElo(this);
  }
}
