import { TennisTable } from "./tennis-table";

export class PlayerTrophies {
  private parent: TennisTable;

  trophyMap: Map<string, AnyTrophy[]> = new Map();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  calculateTrophies() {
    // Clear existing trophies
    this.trophyMap.clear();

    const playerTracker = new Map<
      string,
      {
        firstActiveAt: number;
        lastActiveAt: number;
        winStreakAll: number;
        winStreakAllStartedAt: number;
        winStreakPlayer: Map<string, { count: number; startedAt: number }>;
        donutCount: number; // Track total donuts for donut-5 trophy
      }
    >();

    this.parent.games.forEach((game) => {
      // Initialize player trackers if they don't exist
      if (!playerTracker.has(game.winner)) {
        playerTracker.set(game.winner, {
          firstActiveAt: game.playedAt,
          lastActiveAt: game.playedAt,
          winStreakAll: 0,
          winStreakAllStartedAt: game.playedAt,
          winStreakPlayer: new Map(),
          donutCount: 0,
        });
      }
      if (!playerTracker.has(game.loser)) {
        playerTracker.set(game.loser, {
          firstActiveAt: game.playedAt,
          lastActiveAt: game.playedAt,
          winStreakAll: 0,
          winStreakAllStartedAt: game.playedAt,
          winStreakPlayer: new Map(),
          donutCount: 0,
        });
      }

      const winner = playerTracker.get(game.winner)!;
      const loser = playerTracker.get(game.loser)!;

      // Check for "Back After" trophies before updating lastActiveAt
      this.#checkBackAfterTrophies(game.winner, winner.lastActiveAt, game.playedAt);
      this.#checkBackAfterTrophies(game.loser, loser.lastActiveAt, game.playedAt);

      // Update winner stats
      winner.lastActiveAt = game.playedAt;

      // Start or continue win streak
      if (winner.winStreakAll === 0) {
        winner.winStreakAllStartedAt = game.playedAt;
      }
      winner.winStreakAll++;

      // Update player-specific win streak
      if (!winner.winStreakPlayer.has(game.loser)) {
        winner.winStreakPlayer.set(game.loser, { count: 0, startedAt: game.playedAt });
      }
      const playerStreak = winner.winStreakPlayer.get(game.loser)!;
      if (playerStreak.count === 0) {
        playerStreak.startedAt = game.playedAt;
      }
      playerStreak.count++;

      // Update loser stats
      loser.lastActiveAt = game.playedAt;
      loser.winStreakAll = 0;
      loser.winStreakAllStartedAt = game.playedAt;
      loser.winStreakPlayer.set(game.winner, { count: 0, startedAt: game.playedAt });

      // Check for donut trophies (individual sets where loser scored 0)
      if (game.score?.setPoints) {
        const donutsEarned = this.#checkDonutTrophies(
          game.winner,
          game.loser,
          game.id,
          game.score.setPoints,
          game.playedAt,
        );
        winner.donutCount += donutsEarned;

        // Check if player reached 5 total donuts
        if (winner.donutCount === 5) {
          this.#addTrophy(
            game.winner,
            this.#createTrophy("donut-5", game.winner, game.playedAt, {
              gameId: game.id,
              opponent: game.loser,
            }),
          );
        }
      }

      // Check for streak trophies
      this.#checkStreakTrophies(
        game.winner,
        game.loser,
        winner.winStreakAll,
        winner.winStreakAllStartedAt,
        playerStreak.count,
        playerStreak.startedAt,
        game.playedAt,
      );

      // Check for activity period trophies for both players
      this.#checkActivityTrophies(game.winner, winner.firstActiveAt, game.playedAt);
      this.#checkActivityTrophies(game.loser, loser.firstActiveAt, game.playedAt);
    });
  }

  #checkDonutTrophies(
    winner: string,
    loser: string,
    gameId: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
    playedAt: number,
  ): number {
    let donutsEarned = 0;

    // Check each set for a donut (loser scored 0 points)
    setPoints.forEach((set) => {
      if (set.gameLoser === 0) {
        donutsEarned++;
        // Award a donut-1 trophy for each donut set
        this.#addTrophy(
          winner,
          this.#createTrophy("donut-1", winner, playedAt, {
            gameId,
            opponent: loser,
          }),
        );
      }
    });

    return donutsEarned;
  }

  #checkStreakTrophies(
    winner: string,
    opponent: string,
    streakAll: number,
    streakAllStartedAt: number,
    streakPlayer: number,
    streakPlayerStartedAt: number,
    playedAt: number,
  ) {
    // Check for 10-win streak against all opponents
    if (streakAll === 10) {
      this.#addTrophy(
        winner,
        this.#createTrophy("streak-all-10", winner, playedAt, {
          startedAt: streakAllStartedAt,
        }),
      );
    }

    // Check for 10-win streak against specific player
    if (streakPlayer === 10) {
      this.#addTrophy(
        winner,
        this.#createTrophy("streak-player-10", winner, playedAt, {
          opponent,
          startedAt: streakPlayerStartedAt,
        }),
      );
    }
  }

  #checkBackAfterTrophies(playerId: string, lastActiveAt: number, currentGameAt: number) {
    const timeDiff = currentGameAt - lastActiveAt;
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const TWO_YEARS = 2 * ONE_YEAR;

    // Check if player is coming back after a long break
    // Award the highest tier they qualify for
    if (timeDiff >= TWO_YEARS) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("back-after-2-years", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    } else if (timeDiff >= ONE_YEAR) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("back-after-1-year", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    } else if (timeDiff >= SIX_MONTHS) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("back-after-6-months", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    }
  }

  #checkActivityTrophies(playerId: string, firstActiveAt: number, currentGameAt: number) {
    const activePeriod = currentGameAt - firstActiveAt;
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const TWO_YEARS = 2 * ONE_YEAR;

    const existingTrophies = this.getTrophies(playerId);
    const hasActivetrophy = (type: TrophyType) => existingTrophies.some((t) => t.type === type);

    // Award activity trophies when the player crosses the threshold
    // Only award once - check if they already have it
    if (activePeriod >= TWO_YEARS && !hasActivetrophy("active-2-years")) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("active-2-years", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= ONE_YEAR && !hasActivetrophy("active-1-year")) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("active-1-year", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= SIX_MONTHS && !hasActivetrophy("active-6-months")) {
      this.#addTrophy(
        playerId,
        this.#createTrophy("active-6-months", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    }
  }

  #addTrophy(playerId: string, trophy: AnyTrophy) {
    if (!this.trophyMap.has(playerId)) {
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

  // Helper method to get trophies for a player
  getTrophies(playerId: string): AnyTrophy[] {
    return this.trophyMap.get(playerId) || [];
  }

  // Helper method to get specific trophy type count
  getTrophyCount(playerId: string, trophyType?: TrophyType): number {
    const trophies = this.getTrophies(playerId);
    if (!trophyType) {
      return trophies.length;
    }
    return trophies.filter((t) => t.type === trophyType).length;
  }

  // Helper to get all trophy types a player has earned
  getTrophyTypes(playerId: string): TrophyType[] {
    const trophies = this.getTrophies(playerId);
    return Array.from(new Set(trophies.map((t) => t.type)));
  }
}

// Type Definitions
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

export type AnyTrophy = {
  [K in TrophyType]: Trophy<K>;
}[TrophyType];
