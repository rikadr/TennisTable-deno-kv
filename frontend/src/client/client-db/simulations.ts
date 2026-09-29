import { Elo } from "./elo";
import { solveExpectedScores } from "./expected-scores";
import { Predictions } from "./predictions";
import { TennisTable } from "./tennis-table";

export type ExpectedLeaderboard = {
  current: { id: string; rank: number; score: number }[];
  expected: { id: string; rank: number; score: number }[];
};

export class Simulations {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  expectedWinLoss(diffElo: number, gamesToSimulate: number = 1_000): number {
    let player1Elo = 1_000;
    let player2Elo = player1Elo + diffElo;
    let wins = 0;
    let loss = 0;
    let diffSum = 0;

    for (let i = 1; i <= gamesToSimulate; i++) {
      // Steer on the running AVERAGE gap, not the instantaneous gap: the result
      // is the win rate of matchups whose average elo difference is diffElo.
      // Average slightly over the target -> the game is a win pulling it down,
      // under -> a loss pushing it up.
      diffSum += player2Elo - player1Elo;
      const avgDiff = diffSum / i;
      const player1mustWin = avgDiff > diffElo;
      if (player1mustWin) {
        wins++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player1Elo, player2Elo);
        player1Elo = winnersNewElo;
        player2Elo = losersNewElo;
      } else {
        loss++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player2Elo, player1Elo);
        player1Elo = losersNewElo;
        player2Elo = winnersNewElo;
      }
    }
    return wins / (loss || 1);
  }

  expectedLeaderBoard(includeUnrankedPlayerId?: string): ExpectedLeaderboard {
    const { rankedPlayers } = this.parent.leaderboard.getLeaderboard();
    const currentScores = new Map<string, number>();
    this.parent.leaderboard.getCachedLeaderboardMap().forEach((player, id) => currentScores.set(id, player.elo));

    const expectedScores = this.expectedScores(this.parent.predictions, currentScores, includeUnrankedPlayerId);
    const expected = Array.from(expectedScores, ([id, score]) => ({ id, score }))
      .filter(({ id }) => id === includeUnrankedPlayerId || rankedPlayers.some((ranked) => ranked.id === id))
      .sort((a, b) => b.score - a.score)
      .map((player, index) => ({ ...player, rank: index + 1 }));

    return { current: rankedPlayers.map(({ id, rank, elo }) => ({ id, rank, score: elo })), expected };
  }

  expectedPlayerEloOverTime(
    playerId: string,
    workerCallback: (message: { elements: { elo: number; time: number }[]; progress: number }) => void,
  ): void {
    const player = this.parent.eventStore.playersProjector.getPlayer(playerId);
    if (!player) return;

    const allGames = this.parent.games;

    const playerGameTimes = new Set<number>();
    for (let i = 0; i < allGames.length; i++) {
      const game = allGames[i];
      const isPlayedByPlayer = [game.winner, game.loser].includes(playerId);
      if (isPlayedByPlayer) {
        playerGameTimes.add(game.playedAt);
        const gameBefore = allGames[i - 1];
        if (gameBefore) {
          playerGameTimes.add(gameBefore.playedAt);
        }
      }
    }
    // Add latest game
    playerGameTimes.add(allGames[allGames.length - 1].playedAt);

    const sortedPlayerGameTimes = Array.from(playerGameTimes).sort((a, b) => a - b); // Verify ascending

    // Latest first, so the most recent part of the graph shows first
    const times = sortedPlayerGameTimes.toReversed();
    times.forEach((gameTime, index) => {
      const relevantGames = allGames.filter((g) => g.playedAt <= gameTime);
      const predictions = new Predictions(this.parent, gameTime, relevantGames);
      const scoresAtTime = new Map<string, number>();
      Elo.eloCalculator(relevantGames, this.parent.allPlayers).forEach((p, id) => scoresAtTime.set(id, p.elo));

      const elo = this.expectedScores(predictions, scoresAtTime).get(playerId);
      workerCallback({
        elements: elo === undefined ? [] : [{ elo, time: gameTime }],
        progress: (index + 1) / times.length,
      });
    });
  }

  /**
   * The expected scores of the players in the calculation. The total of the
   * expected scores is equal to the total of the current scores of those players.
   */
  private expectedScores(
    predictions: Predictions,
    currentScores: Map<string, number>,
    includeUnrankedPlayerId?: string,
  ): Map<string, number> {
    const playerIds = predictions.getExpectedScorePlayerIds(includeUnrankedPlayerId);
    if (playerIds.length < 2) return new Map();
    const startScores = new Map(playerIds.map((id) => [id, currentScores.get(id) ?? Elo.INITIAL_ELO]));
    return solveExpectedScores(startScores, predictions.getPairFractions(playerIds));
  }
}
