import { Elo, PlayerWithElo } from "./elo";
import { TennisTable } from "./tennis-table";

export class LeaderboardChanges {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  leaderboardChanges(): {
    playerId: string;
    currentPosition: number;
    netChange: number;
    allChanges: { change: number; time: number }[];
  }[] {
    const oneWeekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;

    const scoreMaps: { time: number; map: Map<string, PlayerWithElo> }[] = [];
    let lastGamesMap: { time: number; map: Map<string, PlayerWithElo> } = { time: 0, map: new Map() };

    Elo.eloCalculator(
      this.parent.games,
      this.parent.allPlayers,
      (map, game) => {
        if (game.playedAt > oneWeekAgo) {
          scoreMaps.push({ time: game.playedAt, map: structuredClone(map) });
        } else {
          lastGamesMap = { time: game.playedAt, map: structuredClone(map) };
        }
      },
      this.parent.getHistoricalPlayerFilter(),
    );

    const leaderboardChangesMap = new Map<
      string,
      { currentPosition: number; netChange: number; allChanges: { change: number; time: number }[] }
    >();

    {
      const leaderboard = Array.from(lastGamesMap.map)
        .filter(([, player]) => player.totalGames >= this.parent.client.gameLimitForRanked)
        .map(([, player]) => ({ id: player.id, score: player.elo }))
        .sort((a, b) => b.score - a.score);
      leaderboard.forEach((player, index) => {
        const current = index + 1;
        leaderboardChangesMap.set(player.id, {
          currentPosition: current,
          netChange: 0,
          allChanges: [],
        });
      });
    }

    scoreMaps.forEach(({ time, map }) => {
      const leaderboard = Array.from(map)
        .filter(([, player]) => player.totalGames >= this.parent.client.gameLimitForRanked)
        .map(([, player]) => ({ id: player.id, score: player.elo }))
        .sort((a, b) => b.score - a.score);
      leaderboard.forEach((player, index) => {
        if (leaderboardChangesMap.has(player.id) === false) {
          const current = index + 1;
          const prev = leaderboard.length;
          leaderboardChangesMap.set(player.id, {
            currentPosition: current,
            netChange: prev - current,
            allChanges: [{ change: prev - current, time }],
          });
        }
        const leaderboardChangeEntry = leaderboardChangesMap.get(player.id)!;
        if (leaderboardChangeEntry.currentPosition !== index + 1) {
          const prev = leaderboardChangeEntry.currentPosition;
          const current = index + 1;
          leaderboardChangeEntry.currentPosition = current;
          leaderboardChangeEntry.netChange += prev - current;
          leaderboardChangeEntry.allChanges.push({ time, change: prev - current });
        }
      });
    });

    return Array.from(leaderboardChangesMap)
      .map(([id, info]) => ({ playerId: id, ...info }))
      .filter((player) => player.allChanges.length > 0)
      .sort((a, b) => a.currentPosition - b.currentPosition);
  }
}
