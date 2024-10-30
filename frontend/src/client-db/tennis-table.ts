import { Elo } from "./elo";
import { Leaderboard } from "./leaderboard";
import { PVP } from "./pvp";
import { ClientDbDTO, Game, Player, PlayerWithElo } from "./types";

export class TennisTable {
  players: Player[] = [];
  games: Game[] = [];
  leaderboard: Leaderboard;
  pvp: PVP;

  constructor(data: ClientDbDTO) {
    this.players = data.players;
    this.games = data.games;
    this.leaderboard = new Leaderboard(data);
    this.pvp = new PVP(data);
  }

  getAllPlayersELO(): PlayerWithElo[] {
    const map = Elo.eloCalculator(this.games, this.players);
    const playersWithElo = Array.from(map.values());

    playersWithElo.sort((a, b) => b.elo - a.elo);
    return playersWithElo;
  }
}
