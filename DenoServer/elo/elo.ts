import { Game, getAllGames } from "../game/game.ts";
import { Player, getAllPlayers } from "../player/player.ts";

type PlayerWithElo = Player & { elo: number };

const K = 32;
export const INITIAL_ELO = 1_000;

function calculateELO(winnersElo: number, losersElo: number) {
  // Calculate the expected scores for both players
  const expectedScoreWinner = 1 / (1 + Math.pow(10, (losersElo - winnersElo) / 400));
  const expectedScoreLoser = 1 / (1 + Math.pow(10, (winnersElo - losersElo) / 400));

  // Update ELO ratings
  const winnersNewElo = winnersElo + K * (1 - expectedScoreWinner);
  const losersNewElo = losersElo + K * (0 - expectedScoreLoser);

  return {
    winnersNewElo,
    losersNewElo,
  };
}

export async function getAllPlayersELO(): Promise<PlayerWithElo[]> {
  const [games, players] = await Promise.all([getAllGames(), getAllPlayers()]);
  const map = eloCalculator(games, players);
  const playersWithElo = Array.from(map.values());

  playersWithElo.sort((a, b) => b.elo - a.elo);
  return playersWithElo;
}

export function eloCalculator(
  games: Game[],
  players: Player[],
  injectedFunction?: (map: Map<string, PlayerWithElo>, game: Game, pointsWon: number) => void,
): Map<string, PlayerWithElo> {
  const playerMap = new Map<string, PlayerWithElo>();

  players.forEach((player) => {
    playerMap.set(player.name, { ...player, elo: INITIAL_ELO });
  });

  games.forEach((game) => {
    const winner = playerMap.get(game.winner);
    const loser = playerMap.get(game.loser);
    if (winner && loser) {
      // Only games with both players existing in the player list will counted
      const { winnersNewElo, losersNewElo } = calculateELO(winner.elo, loser.elo);
      const pointsWon = winnersNewElo - winner.elo;
      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;
      injectedFunction && injectedFunction(playerMap, game, pointsWon);
    }
  });
  return playerMap;
}
