import { TennisTable } from "./tennis-table";

export class PlayerTrophies {
  private parent: TennisTable;

  trophyMap: Map<string, AnyTrophy[]> = new Map();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  calculateTrophies() {
    const playerTracker = new Map<
      string,
      {
        firstActiveAt: number;
        lastActiveAt: number;
        winStreakAll: number;
        winStreakPlayer: Map<string, number>;
      }
    >();
    this.parent.games.forEach((game) => {
      if (playerTracker.has(game.winner) === false) {
        playerTracker.set(game.winner, {
          firstActiveAt: game.playedAt,
          lastActiveAt: game.playedAt,
          winStreakAll: 0,
          winStreakPlayer: new Map(),
        });
      }
      if (playerTracker.has(game.loser) === false) {
        playerTracker.set(game.loser, {
          firstActiveAt: game.playedAt,
          lastActiveAt: game.playedAt,
          winStreakAll: 0,
          winStreakPlayer: new Map(),
        });
      }
      // Update tracker info
      const winner = playerTracker.get(game.winner)!;
      const loser = playerTracker.get(game.loser)!;

      winner.lastActiveAt = game.playedAt;
      winner.winStreakAll++;
      if (winner.winStreakPlayer.has(game.loser) === false) {
        winner.winStreakPlayer.set(game.loser, 0);
      }
      winner.winStreakPlayer.set(game.loser, winner.winStreakPlayer.get(game.loser)! + 1);

      loser.lastActiveAt = game.playedAt;
      loser.winStreakAll = 0;
      loser.winStreakPlayer.set(game.loser, 0);

      // Check for trophy achievement
    });
  }

  #addTrophy(playerId: string, trophy: AnyTrophy) {
    if (this.trophyMap.has(playerId) === false) {
      this.trophyMap.set(playerId, []);
    }
    this.trophyMap.get(playerId)!.push(trophy);
  }

  #createTrophy<T extends TrophyType>(
    type: T,
    earnedBy: string,
    earnedAt: number,
    data: TrophyDefinitions[T],
  ): Trophy<T> {
    return { type, earnedBy, earnedAt, data };
  }
}

type TrophyDefinitions = {
  "donut-1": { gameId: string; opponent: string };
  "donut-5": { gameId: string; opponent: string };
  "streak-all-10": { startedAt: number };
  "streak-player-10": { opponent: string; startedAt: number };
  "back-after-6-months": { lastGameAt: number };
  "back-after-1-year": { lastGameAt: number };
  "back-after-2-years": { lastGameAt: number };
  "active-6-months": { firstGameInPeriod: number };
  "active-1-year": { firstGameInPeriod: number };
  "active-2-years": { firstGameInPeriod: number };
};

type TrophyType = keyof TrophyDefinitions;

type Trophy<T extends TrophyType = TrophyType> = {
  type: T;
  earnedBy: string;
  earnedAt: number;
  data: TrophyDefinitions[T];
};

// This creates a union of all possible trophies automatically
export type AnyTrophy = {
  [K in TrophyType]: Trophy<K>;
}[TrophyType];
