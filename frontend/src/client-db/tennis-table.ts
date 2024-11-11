import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { Tournaments } from "./tournament";
import { ClientDbDTO, Game, Player } from "./types";

export class TennisTable {
  // --------------------------------------------------------------------------
  // Data from db
  // --------------------------------------------------------------------------
  readonly players: Player[];
  readonly games: Game[];

  // --------------------------------------------------------------------------
  // Business logic
  // --------------------------------------------------------------------------
  leaderboard: Leaderboard;
  pvp: PVP;
  tournaments: Tournaments;

  constructor(data: ClientDbDTO) {
    this.players = data.players;
    this.games = data.games;

    this.leaderboard = new Leaderboard(this);
    this.pvp = new PVP(this);
    this.tournaments = new Tournaments(this);
  }
}
