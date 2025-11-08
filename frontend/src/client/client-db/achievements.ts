import { TennisTable } from "./tennis-table";

export class Achievements {
  private parent: TennisTable;

  achievementMap: Map<string, Achievement[]> = new Map();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  calculateAchievements() {
    // Clear existing achievements
    this.achievementMap.clear();

    const playerTracker = new Map<
      string,
      {
        firstActiveAt: number;
        lastActiveAt: number;
        winStreakAll: number;
        winStreakAllStartedAt: number;
        winStreakPlayer: Map<string, { count: number; startedAt: number }>;
        donutCount: number; // Track total donuts for donut-5 achievement
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

      // Check for "Back After" achievements before updating lastActiveAt
      this.#checkBackAfterAchievement(game.winner, winner.lastActiveAt, game.playedAt);
      this.#checkBackAfterAchievement(game.loser, loser.lastActiveAt, game.playedAt);

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

      // Check for donut achievements (individual sets where loser scored 0)
      if (game.score?.setPoints) {
        const donutsEarned = this.#checkDonutAchievements(
          game.winner,
          game.loser,
          game.id,
          game.score.setPoints,
          game.playedAt,
        );
        winner.donutCount += donutsEarned;

        // Check if player reached 5 total donuts
        if (winner.donutCount === 5) {
          this.#addAchievement(
            game.winner,
            this.#createAchievement("donut-5", game.winner, game.playedAt, {
              gameId: game.id,
              opponent: game.loser,
            }),
          );
        }
      }

      // Check for streak achievements
      this.#checkStreakAchievements(
        game.winner,
        game.loser,
        winner.winStreakAll,
        winner.winStreakAllStartedAt,
        playerStreak.count,
        playerStreak.startedAt,
        game.playedAt,
      );

      // Check for activity period achievements for both players
      this.#checkActivityAchievements(game.winner, winner.firstActiveAt, game.playedAt);
      this.#checkActivityAchievements(game.loser, loser.firstActiveAt, game.playedAt);
    });
  }

  #checkDonutAchievements(
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
        // Award a donut-1 achievement for each donut set
        this.#addAchievement(
          winner,
          this.#createAchievement("donut-1", winner, playedAt, {
            gameId,
            opponent: loser,
          }),
        );
      }
    });

    return donutsEarned;
  }

  #checkStreakAchievements(
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
      this.#addAchievement(
        winner,
        this.#createAchievement("streak-all-10", winner, playedAt, {
          startedAt: streakAllStartedAt,
        }),
      );
    }

    // Check for 10-win streak against specific player
    if (streakPlayer === 10) {
      this.#addAchievement(
        winner,
        this.#createAchievement("streak-player-10", winner, playedAt, {
          opponent,
          startedAt: streakPlayerStartedAt,
        }),
      );
    }
  }

  #checkBackAfterAchievement(playerId: string, lastActiveAt: number, currentGameAt: number) {
    const timeDiff = currentGameAt - lastActiveAt;
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const TWO_YEARS = 2 * ONE_YEAR;

    // Check if player is coming back after a long break
    // Award the highest tier they qualify for
    if (timeDiff >= TWO_YEARS) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("back-after-2-years", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    } else if (timeDiff >= ONE_YEAR) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("back-after-1-year", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    } else if (timeDiff >= SIX_MONTHS) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("back-after-6-months", playerId, currentGameAt, {
          lastGameAt: lastActiveAt,
        }),
      );
    }
  }

  #checkActivityAchievements(playerId: string, firstActiveAt: number, currentGameAt: number) {
    const activePeriod = currentGameAt - firstActiveAt;
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const TWO_YEARS = 2 * ONE_YEAR;

    const existingAchievements = this.getAchievements(playerId);
    const hasActiveAchievement = (type: AchievementType) => existingAchievements.some((t) => t.type === type);

    // Award activity achievements when the player crosses the threshold
    // Only award once - check if they already have it
    if (activePeriod >= TWO_YEARS && !hasActiveAchievement("active-2-years")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-2-years", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= ONE_YEAR && !hasActiveAchievement("active-1-year")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-1-year", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= SIX_MONTHS && !hasActiveAchievement("active-6-months")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-6-months", playerId, currentGameAt, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    }
  }

  #addAchievement(playerId: string, achievement: Achievement) {
    if (!this.achievementMap.has(playerId)) {
      this.achievementMap.set(playerId, []);
    }
    this.achievementMap.get(playerId)!.push(achievement);
  }

  #createAchievement<T extends AchievementType>(
    type: T,
    earnedBy: string,
    earnedAt: number,
    data: AchievementDefinitions[T],
  ): GenericAchievement<T> {
    return { type, earnedBy, earnedAt, data };
  }

  // Helper method to get achievements for a player
  getAchievements(playerId: string): Achievement[] {
    return this.achievementMap.get(playerId) || [];
  }

  // Helper method to get specific achievement type count
  getAchievementCount(playerId: string, achievementType?: AchievementType): number {
    const achievements = this.getAchievements(playerId);
    if (!achievementType) {
      return achievements.length;
    }
    return achievements.filter((t) => t.type === achievementType).length;
  }

  // Helper to get all achievement types a player has earned
  getAchievementTypes(playerId: string): AchievementType[] {
    const achievements = this.getAchievements(playerId);
    return Array.from(new Set(achievements.map((t) => t.type)));
  }

  // Get player's progression towards all achievements
  getPlayerProgression(playerId: string): AchievementProgression {
    const progression: AchievementProgression = {
      "donut-1": { current: 0, target: 1, earned: 0 },
      "donut-5": { current: 0, target: 5, earned: 0 },
      "streak-all-10": { current: 0, target: 10, earned: 0 },
      "streak-player-10": { current: 0, target: 10, perOpponent: new Map(), earned: 0 },
      "back-after-6-months": { earned: 0 },
      "back-after-1-year": { earned: 0 },
      "back-after-2-years": { earned: 0 },
      "active-6-months": { current: 0, target: 6 * 30 * 24 * 60 * 60 * 1000, earned: 0 },
      "active-1-year": { current: 0, target: 365 * 24 * 60 * 60 * 1000, earned: 0 },
      "active-2-years": { current: 0, target: 2 * 365 * 24 * 60 * 60 * 1000, earned: 0 },
    };

    let firstActiveAt: number | null = null;
    let lastActiveAt: number | null = null;
    let currentWinStreakAll = 0;
    let donutCount = 0;
    const streaksPerOpponent = new Map<string, number>();

    // Calculate current stats by iterating through games
    this.parent.games.forEach((game) => {
      const isWinner = game.winner === playerId;
      const isLoser = game.loser === playerId;

      if (!isWinner && !isLoser) return;

      // Track first and last active times
      if (firstActiveAt === null) {
        firstActiveAt = game.playedAt;
      }
      lastActiveAt = game.playedAt;

      if (isWinner) {
        // Track win streak against all
        currentWinStreakAll++;

        // Track win streak against specific opponent
        const opponent = game.loser;
        streaksPerOpponent.set(opponent, (streaksPerOpponent.get(opponent) || 0) + 1);

        // Count donuts
        if (game.score?.setPoints) {
          game.score.setPoints.forEach((set) => {
            if (set.gameLoser === 0) {
              donutCount++;
            }
          });
        }
      } else {
        // Lost a game - reset win streak
        currentWinStreakAll = 0;
        // Reset streak against this specific opponent
        if (isLoser) {
          streaksPerOpponent.set(game.winner, 0);
        }
      }
    });

    // Update progression with current stats
    progression["donut-1"].current = donutCount;
    progression["donut-5"].current = donutCount;
    progression["streak-all-10"].current = currentWinStreakAll;
    progression["streak-player-10"].current = Math.max(...Array.from(streaksPerOpponent.values()), 0);

    // Add per-opponent streak details
    streaksPerOpponent.forEach((streak, opponent) => {
      if (streak > 0) {
        progression["streak-player-10"].perOpponent!.set(opponent, streak);
      }
    });

    // Calculate active period
    if (firstActiveAt !== null && lastActiveAt !== null) {
      const activePeriod = lastActiveAt - firstActiveAt;
      progression["active-6-months"].current = activePeriod;
      progression["active-1-year"].current = activePeriod;
      progression["active-2-years"].current = activePeriod;
    }

    // Count earned achievements
    const achievements = this.getAchievements(playerId);
    achievements.forEach((achievement) => {
      const type = achievement.type;
      if (type in progression) {
        progression[type].earned++;
      }
    });

    return progression;
  }
}

// Type Definitions
type AchievementDefinitions = {
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

type AchievementType = keyof AchievementDefinitions;

type GenericAchievement<T extends AchievementType = AchievementType> = {
  type: T;
  earnedBy: string;
  earnedAt: number;
  data: AchievementDefinitions[T];
};

export type Achievement = {
  [K in AchievementType]: GenericAchievement<K>;
}[AchievementType];

// Progression Types
type BaseProgression = {
  earned: number; // How many times this achievement has been earned
};

type ProgressionWithTarget = BaseProgression & {
  current: number; // Current progress value
  target: number; // Target value needed to earn achievement
};

type StreakPlayerProgression = ProgressionWithTarget & {
  perOpponent?: Map<string, number>; // Breakdown of current streaks per opponent
};

export type AchievementProgression = {
  "donut-1": ProgressionWithTarget;
  "donut-5": ProgressionWithTarget;
  "streak-all-10": ProgressionWithTarget;
  "streak-player-10": StreakPlayerProgression;
  "back-after-6-months": BaseProgression; // Can't predict when someone will return
  "back-after-1-year": BaseProgression;
  "back-after-2-years": BaseProgression;
  "active-6-months": ProgressionWithTarget;
  "active-1-year": ProgressionWithTarget;
  "active-2-years": ProgressionWithTarget;
};
