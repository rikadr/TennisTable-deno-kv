import { Elo } from "./elo";
import { FutureElo } from "./future-elo";
import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { Simulations } from "./simulations";
import { Tournaments } from "./tournaments/tournaments";
import { ClientDbDTO, Game, Player, SignUpTournament } from "./types";
import { getClientConfig } from "../client-config/get-client-config";
import { EventType } from "../event-db/event-types";

export class TennisTable {
  isSimulatedState = false;

  // --------------------------------------------------------------------------
  // Data from db
  // --------------------------------------------------------------------------
  readonly players: Player[];
  readonly games: Game[];
  readonly signedUp: SignUpTournament[];
  readonly elo = Elo;
  readonly events: EventType[];

  // --------------------------------------------------------------------------
  // Client configuration
  // --------------------------------------------------------------------------
  client = getClientConfig();

  // --------------------------------------------------------------------------
  // Business logic
  // --------------------------------------------------------------------------
  leaderboard: Leaderboard;
  pvp: PVP;
  tournaments: Tournaments;
  simulations: Simulations;
  futureElo: FutureElo;

  constructor(data: ClientDbDTO & { events: EventType[] }) {
    this.players = data.players;
    this.games = data.games;
    this.signedUp = data.tournament?.signedUp || [];
    this.events = data.events;

    this.leaderboard = new Leaderboard(this);
    this.pvp = new PVP(this);
    this.tournaments = new Tournaments(this);
    this.simulations = new Simulations(this);
    this.futureElo = new FutureElo(this);
  }
}
