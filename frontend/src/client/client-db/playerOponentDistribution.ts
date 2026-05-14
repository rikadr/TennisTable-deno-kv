import { Elo } from "./elo";
import { TennisTable } from "./tennis-table";

const DIFF_GROUP_SIZE = 50;

export class PlayerOponentDistribution {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  get(playerId: string): {
    avgDiff: number;
    diffGraphData: { diffGroup: number; count: number }[];
  } {
    const playerDiffs: number[] = [];
    const allDiffs: number[] = [];

    Elo.eloCalculator(this.parent.games, this.parent.allPlayers, (map, game) => {
      const winnerElo = map.get(game.winner)!.elo;
      const loserElo = map.get(game.loser)!.elo;
      allDiffs.push(winnerElo - loserElo);
      allDiffs.push(loserElo - winnerElo);
      if (game.winner === playerId) {
        playerDiffs.push(loserElo - winnerElo);
      }
      if (game.loser === playerId) {
        playerDiffs.push(winnerElo - loserElo);
      }
    });

    const avgDiff = average(playerDiffs);

    const diffGroupMap = new Map<number, number>();

    for (const diff of playerDiffs) {
      const group = Math.floor(diff / DIFF_GROUP_SIZE) * DIFF_GROUP_SIZE;
      diffGroupMap.set(group, (diffGroupMap.get(group) ?? 0) + 1);
    }

    const diffGraphData: { diffGroup: number; count: number }[] = Array.from(diffGroupMap).map(
      ([diffGroup, count]) => ({ diffGroup, count }),
    );

    // Find the min and max groups from the actual data
    let minGroup = Infinity;
    let maxGroup = -Infinity;
    for (const { diffGroup } of diffGraphData) {
      minGroup = Math.min(minGroup, diffGroup);
      maxGroup = Math.max(maxGroup, diffGroup);
    }

    // Create a complete map with all groups filled in between min and max
    const completeGroupMap = new Map<number, number>();
    for (let group = minGroup; group <= maxGroup; group += DIFF_GROUP_SIZE) {
      completeGroupMap.set(group, 0);
    }

    // Fill in the actual counts
    for (const { diffGroup, count } of diffGraphData) {
      completeGroupMap.set(diffGroup, count);
    }

    // Convert back to sorted array
    const filledDiffGraphData = Array.from(completeGroupMap)
      .map(([diffGroup, count]) => ({ diffGroup, count }))
      .sort((a, b) => a.diffGroup - b.diffGroup);

    return { avgDiff, diffGraphData: filledDiffGraphData };
  }
}

function average(values: number[]): number {
  if (values.length === 0) {
    throw new Error("Input array is empty");
  }
  const sum = values.reduce((sum, value) => sum + value, 0);
  return sum / values.length;
}
