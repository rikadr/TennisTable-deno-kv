import { PairStats } from "./pair-stats";
import { PlayerStrengths } from "./player-strengths";
import { Predictions } from "./predictions";
import { TennisTable } from "./tennis-table";

export type Prediction = {
  winChance: number;
  confidence: number;
  gamesPlayedAgainst: number;
};

export type PredictionHistoryEntry = {
  time: number;
  overAllWinChance: number;
  overAllConfidence: number;
  oponents: Record<string, Prediction>;
  gamesPlayed: number;
};

export class PredictionsHistory {
  private parent: TennisTable;
  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  /**
   * The predictions of the player at up to 150 times from the first game of the player until now, oldest first.
   * `progress` gets all the times first, then each entry when it is ready, newest first.
   */
  computeHistoryForPlayer(
    playerId: string,
    progress?: { onTimes: (times: number[]) => void; onEntry: (entry: PredictionHistoryEntry) => void },
  ): PredictionHistoryEntry[] {
    const allGames = this.parent.games;
    const playersFirstGame = allGames.find((g) => g.winner === playerId || g.loser === playerId);
    if (!playersFirstGame) return [];

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
    progress?.onTimes(times);

    const pairStats = new PairStats(endTime, allGames);
    const strengths = new PlayerStrengths(pairStats);
    const entries: PredictionHistoryEntry[] = [];

    // Newest first, because the stats can only rewind
    for (let i = times.length - 1; i >= 0; i--) {
      const time = times[i];
      const periodStart = i > 0 ? times[i - 1] : 0;

      pairStats.rewindTo(time);
      const gamesInPeriod = allGames.filter((g) => g.playedAt > periodStart && g.playedAt <= time);
      const gamesPlayed = gamesInPeriod.filter((g) => g.winner === playerId || g.loser === playerId).length;

      const predictions = new Predictions(this.parent, time, strengths);

      const oponentsOutput: Record<string, Prediction> = {};

      for (const oponentId of predictions.getAllPlayerIds()) {
        if (oponentId === playerId) continue;
        if (this.parent.eventStore.playersProjector.getPlayer(oponentId)?.active !== true) continue;

        const fraction = predictions.getPredictedFraction(playerId, oponentId);
        if (!fraction) continue;

        const gamesPlayedAgainst = gamesInPeriod.filter(
          (g) => (g.winner === playerId && g.loser === oponentId) || (g.winner === oponentId && g.loser === playerId),
        ).length;

        oponentsOutput[oponentId] = {
          winChance: fraction.fraction,
          confidence: fraction.confidence,
          gamesPlayedAgainst,
        };
      }

      let rankedCount = 0;
      let totalConfidenceSum = 0;
      const totalWinChanceSum = Object.entries(oponentsOutput).reduce((sum, [oponentId, fraction]) => {
        const totalGames = predictions.getPlayerTotalGames(oponentId);
        if (totalGames < this.parent.client.gameLimitForRanked) return sum;
        rankedCount++;
        totalConfidenceSum += fraction.confidence;
        return sum + fraction.winChance;
      }, 0);
      const overAllWinChance = rankedCount === 0 ? 0 : totalWinChanceSum / rankedCount;
      const overAllConfidence = rankedCount === 0 ? 0 : totalConfidenceSum / rankedCount;

      const entry = { time, overAllWinChance, overAllConfidence, oponents: oponentsOutput, gamesPlayed };
      entries.push(entry);
      progress?.onEntry(entry);
    }
    return entries.reverse();
  }
}
