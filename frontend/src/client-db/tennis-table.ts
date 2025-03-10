import { Elo } from "./elo";
import { FutureElo } from "./future-elo";
import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { Simulations } from "./simulations";
import { Tournaments } from "./tournaments";
import { ClientDbDTO, Game, Player, SignUpTournament } from "./types";

export class TennisTable {
  isSimulatedState = false;

  // --------------------------------------------------------------------------
  // Data from db
  // --------------------------------------------------------------------------
  readonly players: Player[];
  readonly games: Game[];
  readonly signedUp: SignUpTournament[];
  readonly elo = Elo;

  // --------------------------------------------------------------------------
  // Business logic
  // --------------------------------------------------------------------------
  leaderboard: Leaderboard;
  pvp: PVP;
  tournaments: Tournaments;
  simulations: Simulations;
  futureElo: FutureElo;

  constructor(data: ClientDbDTO) {
    this.players = data.players;
    this.games = data.games;
    this.signedUp = data.tournament?.signedUp || [];

    this.leaderboard = new Leaderboard(this);
    this.pvp = new PVP(this);
    this.tournaments = new Tournaments(this);
    this.simulations = new Simulations(this);
    this.futureElo = new FutureElo(this);
  }
}
