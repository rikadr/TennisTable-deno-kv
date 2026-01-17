import { TennisTable } from "./tennis-table";

export type Prediction = {
  winChance: number;
  confidence: number;
};

export type PredictionHistoryEntry = {
  time: number;
  overAllWinChance: number;
  overAllConfidence: number;
  oponents: Record<string, Prediction>;
};

export class PredictionsHistory {
  private parent: TennisTable;
  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getHistoryForPlayer(playerId: string): PredictionHistoryEntry[] {
    const playersFirstGame = this.parent.games.find((g) => g.winner === playerId || g.loser === playerId);
    if (!playersFirstGame) {
      return [];
    }
    const startTime = playersFirstGame.playedAt;
    const endTime = Date.now();
    const duration = endTime - startTime;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const maxPoints = 150;
    const step = Math.max(ONE_DAY_MS, duration / (maxPoints - 1));

    const times: number[] = [];
    let currentT = startTime;

    while (currentT < endTime - step * 0.5) {
      times.push(Math.floor(currentT));
      currentT += step;
    }

    times.push(endTime);

    const output: PredictionHistoryEntry[] = [];

    for (const time of times) {
      const games = this.parent.games.filter((g) => g.playedAt <= time);
      this.parent.futureElo.calculatePlayerFractionsForGivenGames(games, time);

      const oponentsOutput: Record<string, Prediction> = {};

      this.parent.futureElo.playersMap.forEach((_, oponentId) => {
        if (oponentId === playerId) {
          return;
        }
        const fraction = this.parent.futureElo.getPredictedFractionForTwoPlayers(playerId, oponentId);
        if (!fraction) {
          return;
        }

        oponentsOutput[oponentId] = {
          winChance: fraction.fraction,
          confidence: fraction.confidence,
        };
      });

      let rankedCount = 0;
      let totalConfidenceSum = 0;
      const totalWinChanceSum = Object.entries(oponentsOutput).reduce((sum, [oponentId, fraction]) => {
        const oponent = this.parent.futureElo.playersMap.get(oponentId);
        if (!oponent || oponent.totalGames < this.parent.client.gameLimitForRanked) return sum;
        rankedCount++;
        totalConfidenceSum += fraction.confidence;
        return sum + fraction.winChance;
      }, 0);
      const overAllWinChance = rankedCount === 0 ? 0 : totalWinChanceSum / rankedCount;
      const overAllConfidence = rankedCount === 0 ? 0 : totalConfidenceSum / rankedCount;

      output.push({
        time,
        overAllWinChance,
        overAllConfidence,
        oponents: oponentsOutput,
      });
    }

    return output;
  }
}
