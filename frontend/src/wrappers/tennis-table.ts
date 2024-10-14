import { Elo } from "./elo";
import { Leaderboard } from "./leaderboard";
import { ClientDbDTO, Game, Player, PlayerWithElo } from "./types";

export class TennisTable {
  public players: Player[] = [];
  public games: Game[] = [];
  public leaderboard: Leaderboard;

  constructor(data: ClientDbDTO) {
    this.players = data.players;
    this.games = data.games;
    this.leaderboard = new Leaderboard(data);
  }

  getAllPlayersELO(): PlayerWithElo[] {
    const map = Elo.eloCalculator(this.games, this.players);
    const playersWithElo = Array.from(map.values());

    playersWithElo.sort((a, b) => b.elo - a.elo);
    return playersWithElo;
  }
}
