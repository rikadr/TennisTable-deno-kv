import { TennisTable } from "./tennis-table";

export class Achievements {
  private parent: TennisTable;
  private hasCalculated = false;

  achievementMap: Map<string, Achievement[]> = new Map();

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  calculateAchievements() {
    if (this.hasCalculated === true) {
      return;
    }
    // Clear existing achievements
    this.achievementMap.clear();

    const playerTracker = new Map<
      string,
      {
        firstActiveAt: number;
        lastActiveAt: number;
        winStreakAll: number;
        winStreakAllStartedAt: number;
        loseStreakAll: number;
        loseStreakAllStartedAt: number;
        winStreakPlayer: Map<string, { count: number; startedAt: number }>;
        donutCount: number;
        closeCallsCount: number;
        edgeLordCount: number;
        consistencyCount: number;
        opponentsPlayed: Set<string>;
        gamesPerOpponent: Map<string, { count: number; firstGame: number }>;
        firstOpponentFor: Set<string>; // Track players this person was first opponent for
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
          loseStreakAll: 0,
          loseStreakAllStartedAt: game.playedAt,
          winStreakPlayer: new Map(),
          donutCount: 0,
          closeCallsCount: 0,
          edgeLordCount: 0,
          consistencyCount: 0,
          opponentsPlayed: new Set(),
          gamesPerOpponent: new Map(),
          firstOpponentFor: new Set(),
        });
      }
      if (!playerTracker.has(game.loser)) {
        playerTracker.set(game.loser, {
          firstActiveAt: game.playedAt,
          lastActiveAt: game.playedAt,
          winStreakAll: 0,
          winStreakAllStartedAt: game.playedAt,
          loseStreakAll: 0,
          loseStreakAllStartedAt: game.playedAt,
          winStreakPlayer: new Map(),
          donutCount: 0,
          closeCallsCount: 0,
          edgeLordCount: 0,
          consistencyCount: 0,
          opponentsPlayed: new Set(),
          gamesPerOpponent: new Map(),
          firstOpponentFor: new Set(),
        });
      }

      const winner = playerTracker.get(game.winner)!;
      const loser = playerTracker.get(game.loser)!;

      // Check for Welcome Committee achievement
      // If this is the loser's first game ever, the winner is their first opponent
      if (loser.firstActiveAt === game.playedAt) {
        winner.firstOpponentFor.add(game.loser);
        if (winner.firstOpponentFor.size === 3) {
          this.#addAchievement(
            game.winner,
            this.#createAchievement("welcome-committee", game.winner, game.playedAt, {
              opponents: Array.from(winner.firstOpponentFor),
            }),
          );
        }
      }
      // If this is the winner's first game ever, the loser is their first opponent
      if (winner.firstActiveAt === game.playedAt) {
        loser.firstOpponentFor.add(game.winner);
        if (loser.firstOpponentFor.size === 3) {
          this.#addAchievement(
            game.loser,
            this.#createAchievement("welcome-committee", game.loser, game.playedAt, {
              opponents: Array.from(loser.firstOpponentFor),
            }),
          );
        }
      }

      // Track opponents for variety-player and global-player achievements
      const winnerPrevOpponentCount = winner.opponentsPlayed.size;
      const loserPrevOpponentCount = loser.opponentsPlayed.size;

      winner.opponentsPlayed.add(game.loser);
      loser.opponentsPlayed.add(game.winner);

      // Check for variety-player achievement (10 different opponents)
      // Only award when crossing the threshold from 9 to 10
      if (winnerPrevOpponentCount < 10 && winner.opponentsPlayed.size === 10) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("variety-player", game.winner, game.playedAt, undefined),
        );
      }
      if (loserPrevOpponentCount < 10 && loser.opponentsPlayed.size === 10) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("variety-player", game.loser, game.playedAt, undefined),
        );
      }

      // Check for global-player achievement (20 different opponents)
      // Only award when crossing the threshold from 19 to 20
      if (winnerPrevOpponentCount < 20 && winner.opponentsPlayed.size === 20) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("global-player", game.winner, game.playedAt, undefined),
        );
      }
      if (loserPrevOpponentCount < 20 && loser.opponentsPlayed.size === 20) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("global-player", game.loser, game.playedAt, undefined),
        );
      }

      // Track games per opponent for best-friends achievement
      if (!winner.gamesPerOpponent.has(game.loser)) {
        winner.gamesPerOpponent.set(game.loser, { count: 0, firstGame: game.playedAt });
      }
      if (!loser.gamesPerOpponent.has(game.winner)) {
        loser.gamesPerOpponent.set(game.winner, { count: 0, firstGame: game.playedAt });
      }

      const winnerOpponentData = winner.gamesPerOpponent.get(game.loser)!;
      const loserOpponentData = loser.gamesPerOpponent.get(game.winner)!;

      winnerOpponentData.count++;
      loserOpponentData.count++;

      // Check for best-friends achievement (50 games within 1 year)
      const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
      if (winnerOpponentData.count === 50 && game.playedAt - winnerOpponentData.firstGame <= ONE_YEAR) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("best-friends", game.winner, game.playedAt, {
            opponent: game.loser,
            firstGame: winnerOpponentData.firstGame,
          }),
        );
      }
      if (loserOpponentData.count === 50 && game.playedAt - loserOpponentData.firstGame <= ONE_YEAR) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("best-friends", game.loser, game.playedAt, {
            opponent: game.winner,
            firstGame: loserOpponentData.firstGame,
          }),
        );
      }

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

      // Check if winner just broke a lose streak
      if (winner.loseStreakAll >= 20) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("unbreakable-spirit", game.winner, game.playedAt, undefined),
        );
      } else if (winner.loseStreakAll >= 10) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("comeback-kid", game.winner, game.playedAt, undefined),
        );
      }

      // Winner resets their lose streak
      winner.loseStreakAll = 0;
      winner.loseStreakAllStartedAt = game.playedAt;

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

      // Start or continue lose streak for loser
      if (loser.loseStreakAll === 0) {
        loser.loseStreakAllStartedAt = game.playedAt;
      }
      loser.loseStreakAll++;

      // Check for lose streak achievements for loser
      if (loser.loseStreakAll === 10) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("punching-bag", game.loser, game.playedAt, {
            startedAt: loser.loseStreakAllStartedAt,
          }),
        );
      } else if (loser.loseStreakAll === 20) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("never-give-up", game.loser, game.playedAt, {
            startedAt: loser.loseStreakAllStartedAt,
          }),
        );
      }

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
        // Only award if they haven't already earned this achievement
        if (winner.donutCount === 5) {
          const hasDonut5 = this.achievementMap.get(game.winner)?.some((a) => a.type === "donut-5");
          if (!hasDonut5) {
            this.#addAchievement(
              game.winner,
              this.#createAchievement("donut-5", game.winner, game.playedAt, undefined),
            );
          }
        }

        // Check for "Nice Game" achievement (total points = 69)
        this.#checkNiceGameAchievement(game.winner, game.loser, game.id, game.score.setPoints, game.playedAt);

        // Check for "Close Calls" achievement (all sets decided by 2 points or less)
        const isCloseCall = this.#checkCloseCallGame(game.score.setPoints);
        if (isCloseCall) {
          winner.closeCallsCount++;
          loser.closeCallsCount++;
          winner.edgeLordCount++;
          loser.edgeLordCount++;

          // Award "Close Calls" achievement when reaching 5
          if (winner.closeCallsCount === 5) {
            this.#addAchievement(
              game.winner,
              this.#createAchievement("close-calls", game.winner, game.playedAt, undefined),
            );
          }

          if (loser.closeCallsCount === 5) {
            this.#addAchievement(
              game.loser,
              this.#createAchievement("close-calls", game.loser, game.playedAt, undefined),
            );
          }

          // Award "Edge Lord" achievement when reaching 20
          if (winner.edgeLordCount === 20) {
            this.#addAchievement(
              game.winner,
              this.#createAchievement("edge-lord", game.winner, game.playedAt, undefined),
            );
          }

          if (loser.edgeLordCount === 20) {
            this.#addAchievement(
              game.loser,
              this.#createAchievement("edge-lord", game.loser, game.playedAt, undefined),
            );
          }
        }

        // Check for "Consistency is Key" achievement (all sets have same score)
        const isConsistent = this.#checkConsistentGame(game.score.setPoints);
        if (isConsistent) {
          winner.consistencyCount++;
          loser.consistencyCount++;

          // Award achievement when reaching 5 consistent games
          if (winner.consistencyCount === 5) {
            this.#addAchievement(
              game.winner,
              this.#createAchievement("consistency-is-key", game.winner, game.playedAt, undefined),
            );
          }

          if (loser.consistencyCount === 5) {
            this.#addAchievement(
              game.loser,
              this.#createAchievement("consistency-is-key", game.loser, game.playedAt, undefined),
            );
          }
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

      // Check for activity period achievements for both players during the game loop
      // This captures activity periods that may have started and ended in the past
      const winnerActivityPeriod = this.#calculateActivityPeriod(game.winner);
      const loserActivityPeriod = this.#calculateActivityPeriod(game.loser);

      if (winnerActivityPeriod) {
        this.#checkActivityAchievements(
          game.winner,
          winnerActivityPeriod.startDate,
          winnerActivityPeriod.startDate + winnerActivityPeriod.period,
        );
      }

      if (loserActivityPeriod) {
        this.#checkActivityAchievements(
          game.loser,
          loserActivityPeriod.startDate,
          loserActivityPeriod.startDate + loserActivityPeriod.period,
        );
      }
    });

    // Check activity achievements for all players after processing all games
    // This ensures players get achievements even if they haven't played recently
    playerTracker.forEach((_, playerId) => {
      const activityPeriod = this.#calculateActivityPeriod(playerId);
      if (activityPeriod) {
        this.#checkActivityAchievements(
          playerId,
          activityPeriod.startDate,
          activityPeriod.startDate + activityPeriod.period,
        );
      }
    });

    // Check for tournament achievements
    this.#checkTournamentAchievements();
    this.hasCalculated = true;
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

  #checkNiceGameAchievement(
    winner: string,
    loser: string,
    gameId: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
    playedAt: number,
  ) {
    // Calculate total points scored by both players
    const totalPoints = setPoints.reduce((sum, set) => sum + set.gameWinner + set.gameLoser, 0);

    if (totalPoints === 69) {
      // Award achievement to both players
      this.#addAchievement(
        winner,
        this.#createAchievement("nice-game", winner, playedAt, {
          gameId,
          opponent: loser,
        }),
      );
      this.#addAchievement(
        loser,
        this.#createAchievement("nice-game", loser, playedAt, {
          gameId,
          opponent: winner,
        }),
      );
    }
  }

  #checkCloseCallGame(setPoints: { gameWinner: number; gameLoser: number }[]): boolean {
    // Must have at least 2 sets
    if (setPoints.length < 2) {
      return false;
    }

    // All sets must be decided by 2 points or less
    return setPoints.every((set) => {
      const difference = Math.abs(set.gameWinner - set.gameLoser);
      return difference <= 2;
    });
  }

  #checkConsistentGame(setPoints: { gameWinner: number; gameLoser: number }[]): boolean {
    // Must have at least 2 sets
    if (setPoints.length < 2) {
      return false;
    }

    // All sets must have the same score (same winner points and same loser points)
    const firstSet = setPoints[0];
    return setPoints.every((set) => set.gameWinner === firstSet.gameWinner && set.gameLoser === firstSet.gameLoser);
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

    // Check for 20-win streak against specific player
    if (streakPlayer === 20) {
      this.#addAchievement(
        winner,
        this.#createAchievement("streak-player-20", winner, playedAt, {
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

    // Check if this specific activity period already has this achievement
    const hasAchievementForPeriod = (type: AchievementType) =>
      existingAchievements.some(
        (achievement) =>
          achievement.type === type &&
          achievement.data &&
          "firstGameInPeriod" in achievement.data &&
          achievement.data.firstGameInPeriod === firstActiveAt,
      );

    // Award activity achievements when the player crosses the threshold
    // Can be earned multiple times, but only once per activity period
    // Set earnedAt to when they actually completed the achievement (firstActiveAt + period)
    if (activePeriod >= TWO_YEARS && !hasAchievementForPeriod("active-2-years")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-2-years", playerId, firstActiveAt + TWO_YEARS, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= ONE_YEAR && !hasAchievementForPeriod("active-1-year")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-1-year", playerId, firstActiveAt + ONE_YEAR, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    } else if (activePeriod >= SIX_MONTHS && !hasAchievementForPeriod("active-6-months")) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("active-6-months", playerId, firstActiveAt + SIX_MONTHS, {
          firstGameInPeriod: firstActiveAt,
        }),
      );
    }
  }

  // Calculate activity period with reset logic for 30+ day gaps
  #calculateActivityPeriod(playerId: string): { period: number; startDate: number } | null {
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

    let periodStart: number | null = null;
    let lastGameAt: number | null = null;

    // Iterate through games to find continuous activity period
    this.parent.games.forEach((game) => {
      const isPlayer = game.winner === playerId || game.loser === playerId;
      if (!isPlayer) return;

      // First game sets the start
      if (periodStart === null) {
        periodStart = game.playedAt;
        lastGameAt = game.playedAt;
        return;
      }

      // Check if there's a 30+ day gap
      const gapSinceLastGame = game.playedAt - lastGameAt!;
      if (gapSinceLastGame >= THIRTY_DAYS) {
        // Reset the period - start over from this game
        periodStart = game.playedAt;
      }

      lastGameAt = game.playedAt;
    });

    if (periodStart === null || lastGameAt === null) {
      return null;
    }

    return {
      period: lastGameAt - periodStart,
      startDate: periodStart,
    };
  }

  #checkTournamentAchievements() {
    this.parent.tournaments.getTournaments().forEach((t) => {
      const tournamentId = t.tournamentDb.id;

      // Check participation for all players in the tournament
      t.tournamentDb.playerOrder?.forEach((playerId) => {
        this.#addAchievement(
          playerId,
          this.#createAchievement("tournament-participated", playerId, t.tournamentDb.startDate, {
            tournamentId,
          }),
        );
      });

      // Check for tournament winner
      if (t.winner && t.endDate) {
        this.#addAchievement(
          t.winner,
          this.#createAchievement("tournament-winner", t.winner, t.endDate, {
            tournamentId,
          }),
        );
      }
    });
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
    const SIX_MONTHS = 6 * 30 * 24 * 60 * 60 * 1000;
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
    const TWO_YEARS = 2 * ONE_YEAR;

    const progression: AchievementProgression = {
      "donut-1": { current: 0, target: 1, earned: 0 },
      "donut-5": { current: 0, target: 5, earned: 0 },
      "streak-all-10": { current: 0, target: 10, earned: 0 },
      "streak-player-10": { current: 0, target: 10, perOpponent: new Map(), earned: 0 },
      "streak-player-20": { current: 0, target: 20, perOpponent: new Map(), earned: 0 },
      "punching-bag": { current: 0, target: 10, earned: 0 },
      "never-give-up": { current: 0, target: 20, earned: 0 },
      "comeback-kid": { earned: 0 },
      "unbreakable-spirit": { earned: 0 },
      "back-after-6-months": { earned: 0, target: SIX_MONTHS },
      "back-after-1-year": { earned: 0, target: ONE_YEAR },
      "back-after-2-years": { earned: 0, target: TWO_YEARS },
      "active-6-months": { current: 0, target: SIX_MONTHS, earned: 0 },
      "active-1-year": { current: 0, target: ONE_YEAR, earned: 0 },
      "active-2-years": { current: 0, target: TWO_YEARS, earned: 0 },
      "tournament-participated": { earned: 0 },
      "tournament-winner": { earned: 0 },
      "nice-game": { earned: 0 },
      "close-calls": { current: 0, target: 5, earned: 0 },
      "edge-lord": { current: 0, target: 20, earned: 0 },
      "consistency-is-key": { current: 0, target: 5, earned: 0 },
      "variety-player": { current: 0, target: 10, opponents: new Set(), earned: 0 },
      "global-player": { current: 0, target: 20, opponents: new Set(), earned: 0 },
      "best-friends": { current: 0, target: 50, perOpponent: new Map(), earned: 0 },
      "welcome-committee": { current: 0, target: 3, newPlayers: new Set(), earned: 0 },
    };

    let firstActiveAt: number | null = null;
    let lastActiveAt: number | null = null;
    let currentWinStreakAll = 0;
    let currentLoseStreakAll = 0;
    let donutCount = 0;
    let closeCallsCount = 0;
    let edgeLordCount = 0;
    let consistencyCount = 0;
    const streaksPerOpponent = new Map<string, number>();
    const opponentsPlayed = new Set<string>();
    const gamesPerOpponent = new Map<string, { count: number; firstGame: number; lastGame: number }>();
    const firstOpponentForSet = new Set<string>();

    // Track first games for each player to determine who was their first opponent
    const playerFirstGames = new Map<string, { opponent: string; timestamp: number }>();

    this.parent.games.forEach((game) => {
      // Track first opponent for each player
      if (!playerFirstGames.has(game.winner)) {
        playerFirstGames.set(game.winner, { opponent: game.loser, timestamp: game.playedAt });
      }
      if (!playerFirstGames.has(game.loser)) {
        playerFirstGames.set(game.loser, { opponent: game.winner, timestamp: game.playedAt });
      }
    });

    // Count how many players have this playerId as their first opponent
    playerFirstGames.forEach((firstGame, player) => {
      if (firstGame.opponent === playerId) {
        firstOpponentForSet.add(player);
      }
    });

    progression["welcome-committee"].current = firstOpponentForSet.size;
    progression["welcome-committee"].newPlayers = firstOpponentForSet;

    // Calculate current stats by iterating through games
    this.parent.games.forEach((game) => {
      const isWinner = game.winner === playerId;
      const isLoser = game.loser === playerId;

      if (!isWinner && !isLoser) return;

      // Track first active time
      if (firstActiveAt === null) {
        firstActiveAt = game.playedAt;
      }

      // Track last active time
      lastActiveAt = game.playedAt;

      // Track opponents
      const opponent = isWinner ? game.loser : game.winner;
      if (isWinner) {
        opponentsPlayed.add(game.loser);
      } else {
        opponentsPlayed.add(game.winner);
      }

      // Track games per opponent for best-friends progression
      if (!gamesPerOpponent.has(opponent)) {
        gamesPerOpponent.set(opponent, { count: 0, firstGame: game.playedAt, lastGame: game.playedAt });
      }
      const opponentData = gamesPerOpponent.get(opponent)!;
      opponentData.count++;
      opponentData.lastGame = game.playedAt;

      if (isWinner) {
        // Track win streak against all
        currentWinStreakAll++;
        currentLoseStreakAll = 0;

        // Track win streak against specific opponent
        streaksPerOpponent.set(opponent, (streaksPerOpponent.get(opponent) || 0) + 1);

        // Count donuts (only for winners)
        if (game.score?.setPoints) {
          game.score.setPoints.forEach((set) => {
            if (set.gameLoser === 0) {
              donutCount++;
            }
          });
        }
      } else {
        // Lost a game - reset win streak and increment lose streak
        currentWinStreakAll = 0;
        currentLoseStreakAll++;

        // Reset streak against this specific opponent
        if (isLoser) {
          streaksPerOpponent.set(game.winner, 0);
        }
      }

      // Count close calls for both winners and losers
      if (game.score?.setPoints && this.#checkCloseCallGame(game.score.setPoints)) {
        closeCallsCount++;
        edgeLordCount++;
      }

      // Count consistent games for both winners and losers
      if (game.score?.setPoints && this.#checkConsistentGame(game.score.setPoints)) {
        consistencyCount++;
      }
    });

    // Update progression with current stats
    progression["donut-1"].current = donutCount;
    progression["donut-5"].current = donutCount;
    progression["streak-all-10"].current = currentWinStreakAll;
    progression["close-calls"].current = closeCallsCount;
    progression["edge-lord"].current = edgeLordCount;
    progression["consistency-is-key"].current = consistencyCount;
    progression["variety-player"].current = opponentsPlayed.size;
    progression["variety-player"].opponents = opponentsPlayed;
    progression["global-player"].current = opponentsPlayed.size;
    progression["global-player"].opponents = opponentsPlayed;
    progression["punching-bag"].current = currentLoseStreakAll;
    progression["never-give-up"].current = currentLoseStreakAll;

    // Get list of opponents we've already earned achievements with
    const earnedBestFriendsOpponents = new Set<string>();
    const playerAchievements = this.achievementMap.get(playerId) || [];
    playerAchievements.forEach((achievement) => {
      if (achievement.type === "best-friends" && achievement.data) {
        earnedBestFriendsOpponents.add(achievement.data.opponent);
      }
      // Note: We don't filter out streak achievements here because they can be earned multiple times
    });

    // Calculate best-friends progression - count games within last 1 year from now
    const now = Date.now();
    let maxGamesInLastYear = 0;
    let maxGamesUnderTarget = 0; // Track highest count that hasn't reached target yet
    const opponentGamesInLastYear = new Map<string, { count: number; timespan: number }>();

    gamesPerOpponent.forEach((_, opponent) => {
      // Count games with this opponent in the last year
      let gamesInLastYear = 0;
      let firstGameInWindow: number | null = null;

      this.parent.games.forEach((game) => {
        const isPlayerGame =
          (game.winner === playerId && game.loser === opponent) ||
          (game.loser === playerId && game.winner === opponent);

        // Check if game is within last year from now
        if (isPlayerGame && now - game.playedAt <= ONE_YEAR) {
          gamesInLastYear++;
          if (firstGameInWindow === null) {
            firstGameInWindow = game.playedAt;
          }
        }
      });

      if (gamesInLastYear > 0 && firstGameInWindow !== null) {
        // Timespan is from the first game in the window to now
        const timespan = now - firstGameInWindow;
        opponentGamesInLastYear.set(opponent, { count: gamesInLastYear, timespan });
      }

      maxGamesInLastYear = Math.max(maxGamesInLastYear, gamesInLastYear);

      // Track the highest count that's still under the target (50)
      // AND we haven't already earned the achievement with this opponent
      if (gamesInLastYear < 50 && !earnedBestFriendsOpponents.has(opponent)) {
        maxGamesUnderTarget = Math.max(maxGamesUnderTarget, gamesInLastYear);
      }
    });

    // Use maxGamesUnderTarget if it exists, otherwise show maxGamesInLastYear
    // (which would be 50+ if all opponents are over the threshold)
    progression["best-friends"].current = maxGamesUnderTarget > 0 ? maxGamesUnderTarget : maxGamesInLastYear;
    progression["best-friends"].perOpponent = opponentGamesInLastYear;

    // Track max streaks under target for streak-player achievements
    let maxStreakUnder10 = 0;
    let maxStreakUnder20 = 0;

    // Add per-opponent streak details
    streaksPerOpponent.forEach((streak, opponent) => {
      if (streak > 0) {
        progression["streak-player-10"].perOpponent!.set(opponent, streak);
        progression["streak-player-20"].perOpponent!.set(opponent, streak);

        // Track highest streak under 10 (regardless of past achievements)
        if (streak < 10) {
          maxStreakUnder10 = Math.max(maxStreakUnder10, streak);
        }

        // Track highest streak under 20 (regardless of past achievements)
        if (streak < 20) {
          maxStreakUnder20 = Math.max(maxStreakUnder20, streak);
        }
      }
    });

    // Set current to max under target, or the actual max if all are at/over
    const maxStreak = Math.max(...Array.from(streaksPerOpponent.values()), 0);
    progression["streak-player-10"].current = maxStreakUnder10 > 0 ? maxStreakUnder10 : maxStreak;
    progression["streak-player-20"].current = maxStreakUnder20 > 0 ? maxStreakUnder20 : maxStreak;

    // Calculate active period with 30-day reset logic
    const activityPeriod = this.#calculateActivityPeriod(playerId);
    if (activityPeriod && lastActiveAt !== null) {
      const now = Date.now();
      const timeSinceLastGame = now - lastActiveAt;
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

      // If it's been less than 30 days since last game, include that time in the ongoing period
      // Otherwise, the activity period has been reset and they're starting fresh
      const ongoingPeriod = timeSinceLastGame < THIRTY_DAYS ? activityPeriod.period + timeSinceLastGame : 0;

      progression["active-6-months"].current = ongoingPeriod;
      progression["active-1-year"].current = ongoingPeriod;
      progression["active-2-years"].current = ongoingPeriod;
    }

    // Calculate back-after progression (time since last activity)
    if (lastActiveAt !== null) {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActiveAt;

      progression["back-after-6-months"].current = timeSinceLastActivity;
      progression["back-after-6-months"].lastActiveAt = lastActiveAt;

      progression["back-after-1-year"].current = timeSinceLastActivity;
      progression["back-after-1-year"].lastActiveAt = lastActiveAt;

      progression["back-after-2-years"].current = timeSinceLastActivity;
      progression["back-after-2-years"].lastActiveAt = lastActiveAt;
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
  "donut-5": undefined;
  "streak-all-10": { startedAt: number };
  "streak-player-10": { opponent: string; startedAt: number };
  "streak-player-20": { opponent: string; startedAt: number };
  "back-after-6-months": { lastGameAt: number };
  "back-after-1-year": { lastGameAt: number };
  "back-after-2-years": { lastGameAt: number };
  "active-6-months": { firstGameInPeriod: number };
  "active-1-year": { firstGameInPeriod: number };
  "active-2-years": { firstGameInPeriod: number };
  "tournament-participated": { tournamentId: string };
  "tournament-winner": { tournamentId: string };
  "nice-game": { gameId: string; opponent: string };
  "close-calls": undefined;
  "edge-lord": undefined;
  "consistency-is-key": undefined;
  "variety-player": undefined;
  "global-player": undefined;
  "best-friends": { opponent: string; firstGame: number };
  "welcome-committee": { opponents: string[] };
  "punching-bag": { startedAt: number };
  "never-give-up": { startedAt: number };
  "comeback-kid": undefined;
  "unbreakable-spirit": undefined;
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

type BackAfterProgression = BaseProgression & {
  current?: number; // Time since last activity (milliseconds)
  target?: number; // Required inactive period (milliseconds)
  lastActiveAt?: number; // When they were last active
};

type StreakPlayerProgression = ProgressionWithTarget & {
  perOpponent?: Map<string, number>; // Breakdown of current streaks per opponent
};

type VarietyPlayerProgression = ProgressionWithTarget & {
  opponents?: Set<string>; // List of opponents played against
};

type BestFriendsProgression = ProgressionWithTarget & {
  perOpponent?: Map<string, { count: number; timespan: number }>;
};

type WelcomeCommitteeProgression = ProgressionWithTarget & {
  newPlayers?: Set<string>; // List of new players this person was first opponent for
};

export type AchievementProgression = {
  "donut-1": ProgressionWithTarget;
  "donut-5": ProgressionWithTarget;
  "streak-all-10": ProgressionWithTarget;
  "streak-player-10": StreakPlayerProgression;
  "streak-player-20": StreakPlayerProgression;
  "back-after-6-months": BackAfterProgression;
  "back-after-1-year": BackAfterProgression;
  "back-after-2-years": BackAfterProgression;
  "active-6-months": ProgressionWithTarget;
  "active-1-year": ProgressionWithTarget;
  "active-2-years": ProgressionWithTarget;
  "tournament-participated": BaseProgression;
  "tournament-winner": BaseProgression;
  "nice-game": BaseProgression;
  "close-calls": ProgressionWithTarget;
  "edge-lord": ProgressionWithTarget;
  "consistency-is-key": ProgressionWithTarget;
  "variety-player": VarietyPlayerProgression;
  "global-player": VarietyPlayerProgression;
  "best-friends": BestFriendsProgression;
  "welcome-committee": WelcomeCommitteeProgression;
  "punching-bag": ProgressionWithTarget;
  "never-give-up": ProgressionWithTarget;
  "comeback-kid": BaseProgression;
  "unbreakable-spirit": BaseProgression;
};
