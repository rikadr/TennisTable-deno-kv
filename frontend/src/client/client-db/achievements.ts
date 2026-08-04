import { Elo } from "./elo";
import { EventTypeEnum } from "./event-store/event-types";
import { Game } from "./event-store/projectors/games-projector";
import { TennisTable } from "./tennis-table";

// Shortest streak that can establish the very first Longest Win / Lose Streak
// record. Below this a run is too ordinary to be a record worth holding. Once
// a record exists the floor is irrelevant — only beating the record counts.
export const STREAK_RECORD_FLOOR = 3;

// Fewest games in one calendar day / week / month that can establish the very
// first Hero of the Day / Week / Month record. Below this a period is too
// ordinary to be a record worth holding. The floor is deliberately the same
// low bar for all three periods — it only matters until the first record
// exists; after that only beating the record counts, and the longer periods
// naturally accumulate higher records on their own.
export const GAMES_IN_PERIOD_RECORD_FLOOR = 3;

// Smallest single-game Elo swing that can establish the very first David /
// Goliath record (the same game sets both — Elo is zero-sum, so the winner's
// gain is the loser's loss). An evenly matched win moves 16 points, so 20
// takes a real upset (the winner roughly 90+ Elo below the loser). The floor
// only matters until the first record exists; after that only a strictly
// bigger swing takes it.
export const UPSET_RECORD_FLOOR = 20;

// How many sets count toward a game's Shootout score. Most games are best of
// 3, but one-set games and best-of-5 games (tournament finals) exist — summing
// every set would hand the record to whoever plays the longest format. Only
// the 3 highest-scoring sets count, so a best of 5 competes on equal terms
// with a best of 3 (shorter games are naturally at a disadvantage).
export const SHOOTOUT_SETS_COUNTED = 3;

// Fewest combined points (across the counted sets) that can establish the very
// first Shootout record. Three ordinary 11–7 sets are ~54 points; the first
// record should take a genuinely point-heavy game, not just any full game.
export const SHOOTOUT_RECORD_FLOOR = 60;

// How often "Milestone Game" is awarded: every 500th league game (the 500th,
// 1,000th, 1,500th, ...), to both players. Deleted games do not count — the
// numbering follows the games that still exist.
export const MILESTONE_GAME_INTERVAL = 500;

export function isMilestoneGameNumber(gameNumber: number): boolean {
  return gameNumber > 0 && gameNumber % MILESTONE_GAME_INTERVAL === 0;
}

// The next milestone strictly above `gameNumber` — what the league is
// currently counting toward. Used by the progression view.
export function nextMilestoneGameNumber(gameNumber: number): number {
  return (Math.floor(gameNumber / MILESTONE_GAME_INTERVAL) + 1) * MILESTONE_GAME_INTERVAL;
}

export class Achievements {
  private parent: TennisTable;
  private hasCalculated = false;

  achievementMap: Map<string, Achievement[]> = new Map();
  // Highest Elo gain each player has achieved from a win where BOTH
  // players were ranked at the time. Used for David progression.
  bestDavidGain: Map<string, number> = new Map();
  // Largest Elo loss each player has suffered from a loss where BOTH
  // players were ranked at the time. Used for Goliath progression.
  worstGoliathLoss: Map<string, number> = new Map();
  // League-wide running records for the David / Goliath achievements: the
  // largest single-game Elo swing between two ranked players to date. The
  // same game always sets both (Elo is zero-sum) so the values are equal —
  // only the holders differ (David's winner, Goliath's loser). Undefined
  // until a swing reaches UPSET_RECORD_FLOOR and establishes the first
  // record. Used by the progression view so players can see the mark to beat.
  davidRecord: { eloGain: number | undefined; holder: string | undefined } = {
    eloGain: undefined,
    holder: undefined,
  };
  goliathRecord: { eloLoss: number | undefined; holder: string | undefined } = {
    eloLoss: undefined,
    holder: undefined,
  };
  // League-wide running record for the Shootout achievement: the most
  // combined points in a single game, counting only the SHOOTOUT_SETS_COUNTED
  // highest-scoring sets so different game formats compete fairly. Both
  // players of the record game hold it together. Undefined until a game
  // reaches SHOOTOUT_RECORD_FLOOR and establishes the first record.
  shootoutRecord: { points: number | undefined; holders: string[] } = {
    points: undefined,
    holders: [],
  };
  // Each player's own highest Shootout score (top-3-sets combined points in
  // one game). Used for Shootout progression.
  bestShootout: Map<string, number> = new Map();
  // Lowest Elo each player has held while ranked, starting from the
  // moment they first crossed gameLimitForRanked games. Used for the
  // Climber achievement and progression. `time` is when that low was
  // set — needed so the awarded achievement can report the "from" date.
  climberAllTimeLow: Map<string, { elo: number; time: number }> = new Map();
  // League-wide running record for the Marathon Set achievement: the
  // highest winning set score from a true-deuce set (winner ≥ 12,
  // loser ≥ 10). Undefined until the first qualifying set establishes
  // the record. Used by the progression view so players can see what
  // they need to beat.
  marathonSetRecord: { score: number | undefined; holder: string | undefined } = {
    score: undefined,
    holder: undefined,
  };
  // League-wide running record for the Leap Frog achievement: the most
  // leaderboard ranks a player has jumped in a single game (while ranked
  // both before and after). Undefined until the first ≥2-rank jump
  // establishes it. Used by the progression view so players can see the
  // record they need to beat.
  leapFrogRecord: { ranksJumped: number | undefined; holder: string | undefined } = {
    ranksJumped: undefined,
    holder: undefined,
  };
  // Each player's own largest single-game leaderboard jump (ranked before
  // and after). Used for Leap Frog progression.
  bestRankJump: Map<string, number> = new Map();
  // League-wide running records for the Earliest / Latest Game achievements:
  // the earliest and latest time-of-day (minutes past local midnight, in the
  // browser's timezone) any game has been played to date. Undefined until the
  // first game seeds them — that first game does not award, since there is no
  // prior record to break.
  earliestGameRecord: { minutesIntoDay: number | undefined } = { minutesIntoDay: undefined };
  latestGameRecord: { minutesIntoDay: number | undefined } = { minutesIntoDay: undefined };
  // League-wide running records for the Longest Win Streak / Longest Lose
  // Streak achievements: the longest run of consecutive wins / losses any
  // player has put together to date. Undefined until a streak reaches
  // STREAK_RECORD_FLOOR and establishes the first record. Used by the
  // progression view so players can see the mark they need to beat.
  winStreakRecord: { length: number | undefined; holder: string | undefined } = {
    length: undefined,
    holder: undefined,
  };
  loseStreakRecord: { length: number | undefined; holder: string | undefined } = {
    length: undefined,
    holder: undefined,
  };
  // League-wide running records for the Hero of the Day / Week / Month
  // achievements: the most games a single player has played in one local
  // calendar day / week (Monday-start) / month. Undefined until a period
  // reaches its record floor and establishes the first record. Used by the
  // progression view so players can see the mark they need to beat.
  gamesInDayRecord: { count: number | undefined; holder: string | undefined } = {
    count: undefined,
    holder: undefined,
  };
  gamesInWeekRecord: { count: number | undefined; holder: string | undefined } = {
    count: undefined,
    holder: undefined,
  };
  gamesInMonthRecord: { count: number | undefined; holder: string | undefined } = {
    count: undefined,
    holder: undefined,
  };

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  calculateAchievements() {
    if (this.hasCalculated === true) {
      return;
    }
    // Clear existing achievements
    this.achievementMap.clear();
    this.bestDavidGain.clear();
    this.worstGoliathLoss.clear();
    this.davidRecord = { eloGain: undefined, holder: undefined };
    this.goliathRecord = { eloLoss: undefined, holder: undefined };
    this.shootoutRecord = { points: undefined, holders: [] };
    this.bestShootout.clear();
    this.climberAllTimeLow.clear();
    this.marathonSetRecord = { score: undefined, holder: undefined };
    this.leapFrogRecord = { ranksJumped: undefined, holder: undefined };
    this.bestRankJump.clear();
    this.earliestGameRecord = { minutesIntoDay: undefined };
    this.latestGameRecord = { minutesIntoDay: undefined };
    this.winStreakRecord = { length: undefined, holder: undefined };
    this.loseStreakRecord = { length: undefined, holder: undefined };
    this.gamesInDayRecord = { count: undefined, holder: undefined };
    this.gamesInWeekRecord = { count: undefined, holder: undefined };
    this.gamesInMonthRecord = { count: undefined, holder: undefined };

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
        // The Longest Win / Lose Streak achievement earned by the streak
        // that is running right now, while this player still holds the
        // record with it — the one that grows as the streak grows. Cleared
        // when the streak breaks, and left in place (but no longer grown)
        // once another player takes the record over.
        openWinStreakRecord: StreakRecordAchievement | undefined;
        openLoseStreakRecord: StreakRecordAchievement | undefined;
        // Per-period state for the Hero of the Day / Week / Month records:
        // the local calendar period (its start timestamp) the player last
        // played in, how many games they have played in it so far, and the
        // Hero award that period's run earned while the player holds the
        // record with it — grown game by game like the streak records,
        // cleared when the period ends.
        heroOfTheDay: HeroPeriodState;
        heroOfTheWeek: HeroPeriodState;
        heroOfTheMonth: HeroPeriodState;
        donutCount: number;
        closeCallsCount: number;
        edgeLordCount: number;
        consistencyCount: number;
        opponentsPlayed: Set<string>;
        gamesPerOpponent: Map<string, { count: number; firstGame: number }>;
        firstOpponentFor: Set<string>; // Track players this person was first opponent for
        hatTrickWins: { playedAt: number }[]; // Track recent wins for hat-trick
        gamesPlayed: number; // Total games played, used for the "ranked" achievement
      }
    >();

    const gameLimitForRanked = this.parent.client.gameLimitForRanked;

    this.parent.games.forEach((game, gameIndex) => {
      // Check for "Milestone Game": awarded to both players of every 500th
      // league game. Deleted games are already gone from parent.games, so
      // they never count.
      const leagueGameNumber = gameIndex + 1;
      if (isMilestoneGameNumber(leagueGameNumber)) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("milestone-game", game.winner, game.playedAt, {
            gameId: game.id,
            opponent: game.loser,
            milestone: leagueGameNumber,
          }),
        );
        this.#addAchievement(
          game.loser,
          this.#createAchievement("milestone-game", game.loser, game.playedAt, {
            gameId: game.id,
            opponent: game.winner,
            milestone: leagueGameNumber,
          }),
        );
      }

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
          openWinStreakRecord: undefined,
          openLoseStreakRecord: undefined,
          heroOfTheDay: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          heroOfTheWeek: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          heroOfTheMonth: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          donutCount: 0,
          closeCallsCount: 0,
          edgeLordCount: 0,
          consistencyCount: 0,
          opponentsPlayed: new Set(),
          gamesPerOpponent: new Map(),
          firstOpponentFor: new Set(),
          hatTrickWins: [],
          gamesPlayed: 0,
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
          openWinStreakRecord: undefined,
          openLoseStreakRecord: undefined,
          heroOfTheDay: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          heroOfTheWeek: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          heroOfTheMonth: { periodStart: 0, gamesInPeriod: 0, openRecord: undefined },
          donutCount: 0,
          closeCallsCount: 0,
          edgeLordCount: 0,
          consistencyCount: 0,
          opponentsPlayed: new Set(),
          gamesPerOpponent: new Map(),
          firstOpponentFor: new Set(),
          hatTrickWins: [],
          gamesPlayed: 0,
        });
      }

      const winner = playerTracker.get(game.winner)!;
      const loser = playerTracker.get(game.loser)!;

      // Check for "First Game" achievement: awarded on a player's very
      // first game ever, win or lose. Earnable once.
      winner.gamesPlayed++;
      if (winner.gamesPlayed === 1) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("first-game", game.winner, game.playedAt, {
            gameId: game.id,
            opponent: game.loser,
          }),
        );
      }
      loser.gamesPlayed++;
      if (loser.gamesPlayed === 1) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("first-game", game.loser, game.playedAt, {
            gameId: game.id,
            opponent: game.winner,
          }),
        );
      }

      // Check for "Ranked" achievement: awarded on the game that pushes a
      // player up to gameLimitForRanked total games — i.e. the game that
      // makes them appear on the leaderboard. Earnable once.
      if (winner.gamesPlayed === gameLimitForRanked) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("ranked", game.winner, game.playedAt, {
            gameId: game.id,
            opponent: game.loser,
          }),
        );
      }
      if (loser.gamesPlayed === gameLimitForRanked) {
        this.#addAchievement(
          game.loser,
          this.#createAchievement("ranked", game.loser, game.playedAt, {
            gameId: game.id,
            opponent: game.winner,
          }),
        );
      }

      // Check for "Earliest Game" / "Latest Game" record-breaking achievements
      this.#checkTimeOfDayAchievements(game);

      // Check for "Hero of the Day / Week / Month": the records for most games
      // by one player in a single day / week / month. Both players played this
      // game; the winner is checked first, so when both cross the same count
      // at once the win breaks the tie.
      this.#checkHeroAchievements(game.winner, winner, game.playedAt);
      this.#checkHeroAchievements(game.loser, loser, game.playedAt);

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
        if (winner.firstOpponentFor.size === 10) {
          this.#addAchievement(
            game.winner,
            this.#createAchievement("community-builder", game.winner, game.playedAt, {
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
        if (loser.firstOpponentFor.size === 10) {
          this.#addAchievement(
            game.loser,
            this.#createAchievement("community-builder", game.loser, game.playedAt, {
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

      // Check for "Anniversary": a game played on the day before, the day of,
      // or the day after a yearly mark of the player's first ever game.
      this.#checkAnniversaryAchievement(game.winner, winner.firstActiveAt, game.playedAt);
      this.#checkAnniversaryAchievement(game.loser, loser.firstActiveAt, game.playedAt);

      // Update winner stats
      winner.lastActiveAt = game.playedAt;

      // Start or continue win streak
      if (winner.winStreakAll === 0) {
        winner.winStreakAllStartedAt = game.playedAt;
      }
      winner.winStreakAll++;

      // Longest Win Streak: the league-wide record for consecutive wins.
      winner.openWinStreakRecord = this.#checkStreakRecordAchievement(
        "longest-win-streak",
        this.winStreakRecord,
        game.winner,
        winner.winStreakAll,
        winner.winStreakAllStartedAt,
        game.playedAt,
        winner.openWinStreakRecord,
      );

      // Check if winner just broke a lose streak
      if (winner.loseStreakAll >= 20) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("unbreakable-spirit", game.winner, game.playedAt, {
            opponent: game.loser,
          }),
        );
      } else if (winner.loseStreakAll >= 10) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("comeback-kid", game.winner, game.playedAt, {
            opponent: game.loser,
          }),
        );
      }

      // Winner resets their lose streak. Any Longest Lose Streak award it
      // earned stops growing here — a later losing run is a new streak.
      winner.loseStreakAll = 0;
      winner.loseStreakAllStartedAt = game.playedAt;
      winner.openLoseStreakRecord = undefined;

      // Update player-specific win streak
      if (!winner.winStreakPlayer.has(game.loser)) {
        winner.winStreakPlayer.set(game.loser, { count: 0, startedAt: game.playedAt });
      }
      const playerStreak = winner.winStreakPlayer.get(game.loser)!;
      if (playerStreak.count === 0) {
        playerStreak.startedAt = game.playedAt;
      }
      playerStreak.count++;

      // Check for Streak Ender: winner just ended a 10+ game win streak.
      // Must read loser.winStreakAll BEFORE it is reset below.
      if (loser.winStreakAll >= 10) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("streak-ender", game.winner, game.playedAt, {
            opponent: game.loser,
            gameId: game.id,
            streakLength: loser.winStreakAll,
          }),
        );
      }

      // Update loser stats. Any Longest Win Streak award their broken streak
      // earned stops growing here — a later winning run is a new streak.
      loser.lastActiveAt = game.playedAt;
      loser.winStreakAll = 0;
      loser.winStreakAllStartedAt = game.playedAt;
      loser.winStreakPlayer.set(game.winner, { count: 0, startedAt: game.playedAt });
      loser.openWinStreakRecord = undefined;

      // Start or continue lose streak for loser
      if (loser.loseStreakAll === 0) {
        loser.loseStreakAllStartedAt = game.playedAt;
      }
      loser.loseStreakAll++;

      // Longest Lose Streak: the league-wide record for consecutive losses.
      loser.openLoseStreakRecord = this.#checkStreakRecordAchievement(
        "longest-lose-streak",
        this.loseStreakRecord,
        game.loser,
        loser.loseStreakAll,
        loser.loseStreakAllStartedAt,
        game.playedAt,
        loser.openLoseStreakRecord,
      );

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

      // Check for marathon-set achievements (each set evaluated in
      // order against the running league-wide record).
      if (game.score?.setPoints) {
        this.#checkMarathonSetAchievements(
          game.winner,
          game.loser,
          game.id,
          game.score.setPoints,
          game.playedAt,
        );
      }

      // Check for the Shootout record: most combined points in a single game,
      // counting only the highest-scoring sets.
      if (game.score?.setPoints) {
        this.#checkShootoutAchievement(game.winner, game.loser, game.id, game.score.setPoints, game.playedAt);
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

        // Check for "Less Is More" achievement (winner scored fewer total points)
        this.#checkLessIsMoreAchievement(game.winner, game.loser, game.id, game.score.setPoints, game.playedAt);

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

      // Check for Hat-trick achievement (3 wins within 90 minutes)
      this.#checkHatTrickAchievement(game.winner, winner.hatTrickWins, game.playedAt);

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

    this.#checkTournamentAchievements();
    this.#checkSeasonAchievements();
    this.#calculateEloAchievements();
    this.#checkFullHouseAndHumbledAchievements();
    this.#checkPerfectDayAndWeekAchievements();
    this.#checkRetirementAchievements();
    this.hasCalculated = true;
  }

  // Awards "Retired" for every PLAYER_DEACTIVATED event and "Back From The
  // Dead" for every PLAYER_REACTIVATED that follows one — both earnable once
  // per retirement. The comeback remembers when the retirement happened so
  // the display can show how long the player was gone. A reactivation with
  // no recorded retirement (shouldn't happen, but events are data) awards
  // nothing.
  #checkRetirementAchievements() {
    const lastRetiredAt = new Map<string, number>();
    for (const event of this.parent.events) {
      if (event.type === EventTypeEnum.PLAYER_DEACTIVATED) {
        lastRetiredAt.set(event.stream, event.time);
        this.#addAchievement(
          event.stream,
          this.#createAchievement("retired", event.stream, event.time, undefined),
        );
      } else if (event.type === EventTypeEnum.PLAYER_REACTIVATED) {
        const retiredAt = lastRetiredAt.get(event.stream);
        if (retiredAt === undefined) continue;
        lastRetiredAt.delete(event.stream);
        this.#addAchievement(
          event.stream,
          this.#createAchievement("back-from-the-dead", event.stream, event.time, { retiredAt }),
        );
      }
    }
  }

  // Awards "Perfect Day" and "Perfect Week".
  //
  // Perfect Day: for every calendar day (local time) on which a player
  // played 5 or more games and won every single one of them (zero losses
  // that day). Stamped at the day's last (winning) game. Only awarded once
  // the day is OVER — a loss later the same day would disqualify it, so an
  // undefeated day still in progress stays a pending attempt (tracked by
  // progression) until local midnight passes.
  //
  // Perfect Week: for every week (Monday-start, local time) in which a
  // player won at least one game on each of 5 consecutive calendar days,
  // all within that same week — Mon–Fri, Tue–Sat or Wed–Sun. A run that
  // crosses into the next week (e.g. Fri–Tue) does not count. Stamped at the
  // game that completed the first such 5-day run; one award per week even if
  // more days are won. Unlike Perfect Day this is awarded immediately:
  // losses never disqualify a week, so nothing later can take it away.
  //
  // Both are earnable multiple times — once per qualifying day / week.
  // Games are already time-ordered, so the completing win's timestamp is
  // the natural earned-at moment.
  #checkPerfectDayAndWeekAchievements() {
    // Local midnight of the day containing `ms`.
    const dayStartOf = (ms: number): number => {
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    // Local Monday-midnight of the working week containing `ms`.
    const weekStartOf = (ms: number): number => {
      const d = new Date(ms);
      d.setHours(0, 0, 0, 0);
      const daysSinceMonday = (d.getDay() + 6) % 7; // getDay: 0=Sun..6=Sat
      d.setDate(d.getDate() - daysSinceMonday);
      return d.getTime();
    };

    type DayStats = { wins: number; losses: number; lastWinAt: number };
    const perDay = new Map<string, Map<number, DayStats>>();
    // daysWon holds day offsets from the week's Monday (0=Mon..6=Sun).
    // startOffset is the first day of the 5-day run that completed the week
    // (only meaningful once completedAt is set).
    type WeekStats = { daysWon: Set<number>; completedAt: number | null; startOffset: number };
    const perWeek = new Map<string, Map<number, WeekStats>>();

    const getDayStats = (playerId: string, day: number): DayStats => {
      let days = perDay.get(playerId);
      if (!days) {
        days = new Map();
        perDay.set(playerId, days);
      }
      let stats = days.get(day);
      if (!stats) {
        stats = { wins: 0, losses: 0, lastWinAt: 0 };
        days.set(day, stats);
      }
      return stats;
    };
    const getWeekStats = (playerId: string, week: number): WeekStats => {
      let weeks = perWeek.get(playerId);
      if (!weeks) {
        weeks = new Map();
        perWeek.set(playerId, weeks);
      }
      let stats = weeks.get(week);
      if (!stats) {
        stats = { daysWon: new Set(), completedAt: null, startOffset: 0 };
        weeks.set(week, stats);
      }
      return stats;
    };

    this.parent.games.forEach((game) => {
      const day = dayStartOf(game.playedAt);
      const winnerDay = getDayStats(game.winner, day);
      winnerDay.wins++;
      winnerDay.lastWinAt = game.playedAt;
      getDayStats(game.loser, day).losses++;

      // Perfect Week counts wins on any day; what matters is completing a
      // run of 5 consecutive won days inside the week (start offset 0, 1 or
      // 2 — Mon–Fri, Tue–Sat or Wed–Sun).
      const dayOffset = (new Date(game.playedAt).getDay() + 6) % 7; // 0=Mon..6=Sun
      const week = weekStartOf(game.playedAt);
      const winnerWeek = getWeekStats(game.winner, week);
      if (!winnerWeek.daysWon.has(dayOffset)) {
        winnerWeek.daysWon.add(dayOffset);
        if (winnerWeek.completedAt === null) {
          for (let start = 0; start <= 2; start++) {
            let runComplete = true;
            for (let offset = start; offset < start + 5; offset++) {
              if (!winnerWeek.daysWon.has(offset)) {
                runComplete = false;
                break;
              }
            }
            if (runComplete) {
              winnerWeek.completedAt = game.playedAt;
              winnerWeek.startOffset = start;
              break;
            }
          }
        }
      }
    });

    // Award Perfect Day for each undefeated 5+ game day, in day order. Days
    // that have not fully elapsed are skipped: more games can still be played,
    // and a single loss would nullify the day.
    const todayStart = dayStartOf(Date.now());
    for (const [playerId, days] of perDay) {
      const sortedDays = Array.from(days.entries()).sort((a, b) => a[0] - b[0]);
      for (const [day, stats] of sortedDays) {
        if (day >= todayStart) continue;
        if (stats.losses === 0 && stats.wins >= 5) {
          this.#addAchievement(
            playerId,
            this.#createAchievement("perfect-day", playerId, stats.lastWinAt, {
              day,
              wins: stats.wins,
            }),
          );
        }
      }
    }

    // Award Perfect Week for each week with a completed 5-day run, in week
    // order. setDate keeps local midnight across DST, so the run's first day
    // is derived from the week's Monday rather than by adding 24h multiples.
    for (const [playerId, weeks] of perWeek) {
      const sortedWeeks = Array.from(weeks.entries()).sort((a, b) => a[0] - b[0]);
      for (const [week, stats] of sortedWeeks) {
        if (stats.completedAt !== null) {
          const startDate = new Date(week);
          startDate.setDate(startDate.getDate() + stats.startOffset);
          this.#addAchievement(
            playerId,
            this.#createAchievement("perfect-week", playerId, stats.completedAt, {
              weekStart: week,
              startDay: startDate.getTime(),
            }),
          );
        }
      }
    }
  }

  // Awards "Full House" (beat every currently ranked player at least once)
  // and "Humbled" (lose to every currently ranked player at least once). The
  // target cohort is the set of ranked players AT THE MOMENT being evaluated,
  // which shifts as players cross the ranked threshold or are deactivated /
  // reactivated (a deactivated player is not ranked). A win / loss counts
  // whenever it happened (even before the opponent was ranked); what matters
  // is the opponent belongs to the cohort at the time of the check.
  //
  // Because the cohort shrinks when a player is deactivated, either
  // achievement can be earned by a DEACTIVATION rather than a game: if the
  // deactivated player was the only ranked player you had not yet beaten
  // (or lost to), the set completes the instant they drop off the
  // leaderboard. To catch that, games and active-state changes are replayed
  // in time order and the whole ranked cohort is re-checked after each.
  //
  // Requires ≥5 ranked players in the cohort so completing the set is a real
  // feat, matching the gate used by the rank achievements. The earner
  // does NOT need to be ranked themselves — an unranked player who has beaten
  // (or lost to) the whole ranked field still qualifies. Each is awarded
  // once, stamped at the moment the set completes, recording how many players
  // were beaten / lost to and the player's first game (so the display can
  // show how long it took).
  #checkFullHouseAndHumbledAchievements() {
    const gameLimit = this.parent.client.gameLimitForRanked;

    // Per-player active-status timeline (same construction as the Elo pass).
    type Transition = { time: number; active: boolean };
    const timelines = new Map<string, Transition[]>();
    for (const event of this.parent.events) {
      let transition: Transition | null = null;
      if (event.type === EventTypeEnum.PLAYER_CREATED) {
        transition = { time: event.time, active: true };
      } else if (event.type === EventTypeEnum.PLAYER_DEACTIVATED) {
        transition = { time: event.time, active: false };
      } else if (event.type === EventTypeEnum.PLAYER_REACTIVATED) {
        transition = { time: event.time, active: true };
      }
      if (transition) {
        const list = timelines.get(event.stream);
        if (list) list.push(transition);
        else timelines.set(event.stream, [transition]);
      }
    }
    for (const list of timelines.values()) list.sort((a, b) => a.time - b.time);

    const isActiveAt = (playerId: string, atTime: number): boolean => {
      const tl = timelines.get(playerId);
      if (!tl || tl.length === 0) return false;
      let active = false;
      for (const t of tl) {
        if (t.time > atTime) break;
        active = t.active;
      }
      return active;
    };

    const totalGames = new Map<string, number>();
    const firstGameAt = new Map<string, number>();
    const beaten = new Map<string, Set<string>>();
    const lostTo = new Map<string, Set<string>>();
    const fullHouseAwarded = new Set<string>();
    const humbledAwarded = new Set<string>();

    const addEdge = (map: Map<string, Set<string>>, key: string, value: string) => {
      let set = map.get(key);
      if (!set) {
        set = new Set();
        map.set(key, set);
      }
      set.add(value);
    };

    // The ranked cohort at `atTime`: players with ≥ gameLimit games so far
    // who are active at that moment (a deactivated player is not ranked).
    const cohortAt = (atTime: number): Set<string> => {
      const cohort = new Set<string>();
      for (const [id, games] of totalGames) {
        if (games < gameLimit) continue;
        if (!isActiveAt(id, atTime)) continue;
        cohort.add(id);
      }
      return cohort;
    };

    // Whether `playerId` has an edge to every OTHER member of `cohort`.
    const coversCohort = (edges: Set<string> | undefined, cohort: Set<string>, playerId: string): boolean => {
      if (!edges) return false;
      for (const target of cohort) {
        if (target === playerId) continue;
        if (!edges.has(target)) return false;
      }
      return true;
    };

    const recheckAt = (time: number) => {
      const cohort = cohortAt(time);
      if (cohort.size < 5) return;
      // Candidates are everyone who has played a game — the earner need not
      // be part of the ranked cohort themselves. When the earner IS ranked
      // they are excluded from their own target (they can't beat themselves),
      // so the number to beat / lose to is the cohort minus one.
      for (const playerId of totalGames.keys()) {
        const targetCount = cohort.size - (cohort.has(playerId) ? 1 : 0);
        if (!fullHouseAwarded.has(playerId) && coversCohort(beaten.get(playerId), cohort, playerId)) {
          fullHouseAwarded.add(playerId);
          this.#addAchievement(
            playerId,
            this.#createAchievement("full-house", playerId, time, {
              count: targetCount,
              firstGameAt: firstGameAt.get(playerId)!,
            }),
          );
        }
        if (!humbledAwarded.has(playerId) && coversCohort(lostTo.get(playerId), cohort, playerId)) {
          humbledAwarded.add(playerId);
          this.#addAchievement(
            playerId,
            this.#createAchievement("humbled", playerId, time, {
              count: targetCount,
              firstGameAt: firstGameAt.get(playerId)!,
            }),
          );
        }
      }
    };

    // Replay games and active-state changes in time order. Games at the same
    // instant as a state change are applied first so the recheck sees the
    // post-game totals. A game recheck can newly complete the winner/loser
    // (or, via a threshold crossing, anyone); a state-change recheck can
    // complete a player whose last missing opponent just left the cohort.
    type Action = { kind: "game"; time: number; game: Game } | { kind: "recheck"; time: number };
    const actions: Action[] = [];
    for (const g of this.parent.games) {
      actions.push({ kind: "game", time: g.playedAt, game: g });
    }
    for (const e of this.parent.events) {
      if (e.type === EventTypeEnum.PLAYER_DEACTIVATED || e.type === EventTypeEnum.PLAYER_REACTIVATED) {
        actions.push({ kind: "recheck", time: e.time });
      }
    }
    actions.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (a.kind === b.kind) return 0;
      return a.kind === "game" ? -1 : 1;
    });

    for (const action of actions) {
      if (action.kind === "game") {
        const game = action.game;
        totalGames.set(game.winner, (totalGames.get(game.winner) ?? 0) + 1);
        totalGames.set(game.loser, (totalGames.get(game.loser) ?? 0) + 1);
        if (!firstGameAt.has(game.winner)) firstGameAt.set(game.winner, game.playedAt);
        if (!firstGameAt.has(game.loser)) firstGameAt.set(game.loser, game.playedAt);
        addEdge(beaten, game.winner, game.loser);
        addEdge(lostTo, game.loser, game.winner);
      }
      recheckAt(action.time);
    }
  }

  /**
   * Runs a second pass over games to award Elo / rank-derived achievements.
   *
   * Uses its own minimal Elo tracker (only `elo` + `totalGames` per player)
   * plus per-player active-status timelines derived from PLAYER_CREATED /
   * PLAYER_DEACTIVATED / PLAYER_REACTIVATED events. Rank is computed using
   * the leaderboard definition — a player must have ≥ gameLimitForRanked
   * games and have been active at the moment of the game.
   *
   * Per-game cost is O(P) for rank lookups (with a tiny isActiveAt factor).
   * Total O(G * P).
   */
  #calculateEloAchievements() {
    const gameLimit = this.parent.client.gameLimitForRanked;

    type EloEntry = { elo: number; totalGames: number };
    const playerMap = new Map<string, EloEntry>();
    for (const player of this.parent.allPlayers) {
      playerMap.set(player.id, { elo: Elo.INITIAL_ELO, totalGames: 0 });
    }

    // Per-player active-status timeline: each entry is a transition.
    // PLAYER_CREATED -> active=true, PLAYER_DEACTIVATED -> false,
    // PLAYER_REACTIVATED -> true. Sorted by time.
    type Transition = { time: number; active: boolean };
    const timelines = new Map<string, Transition[]>();
    for (const event of this.parent.events) {
      let transition: Transition | null = null;
      if (event.type === EventTypeEnum.PLAYER_CREATED) {
        transition = { time: event.time, active: true };
      } else if (event.type === EventTypeEnum.PLAYER_DEACTIVATED) {
        transition = { time: event.time, active: false };
      } else if (event.type === EventTypeEnum.PLAYER_REACTIVATED) {
        transition = { time: event.time, active: true };
      }
      if (transition) {
        const list = timelines.get(event.stream);
        if (list) list.push(transition);
        else timelines.set(event.stream, [transition]);
      }
    }
    for (const list of timelines.values()) list.sort((a, b) => a.time - b.time);

    const isActiveAt = (playerId: string, atTime: number): boolean => {
      const tl = timelines.get(playerId);
      if (!tl || tl.length === 0) return false;
      let active = false;
      for (const t of tl) {
        if (t.time > atTime) break;
        active = t.active;
      }
      return active;
    };

    // Returns null if the player isn't ranked at `atTime` — must have ≥
    // gameLimitForRanked games and have been active at that moment.
    const getRank = (playerId: string, atTime: number): number | null => {
      const player = playerMap.get(playerId);
      if (!player || player.totalGames < gameLimit) return null;
      if (!isActiveAt(playerId, atTime)) return null;
      let higher = 0;
      for (const [otherId, other] of playerMap) {
        if (otherId === playerId) continue;
        if (other.totalGames < gameLimit) continue;
        if (!isActiveAt(otherId, atTime)) continue;
        if (other.elo > player.elo) higher++;
      }
      return higher + 1;
    };

    // Total number of ranked active players at `atTime`. Used to gate
    // achievements that should require a non-trivial leaderboard.
    const countRankedAt = (atTime: number): number => {
      let count = 0;
      for (const [id, player] of playerMap) {
        if (player.totalGames < gameLimit) continue;
        if (!isActiveAt(id, atTime)) continue;
        count++;
      }
      return count;
    };

    const touchedThrone = new Set<string>();
    const onPodium = new Set<string>();
    const kingslayed = new Set<string>();
    const climber = new Set<string>();

    // Per-player map of opponent → net Elo gained from that opponent.
    // When a player first reaches rank #1, the opponent who contributed
    // the largest positive net Elo to that climb is awarded King Maker.
    const netGainPerOpponent = new Map<string, Map<string, number>>();
    const updateNetGain = (player: string, opponent: string, delta: number) => {
      let map = netGainPerOpponent.get(player);
      if (!map) {
        map = new Map();
        netGainPerOpponent.set(player, map);
      }
      map.set(opponent, (map.get(opponent) ?? 0) + delta);
    };

    // Award King Maker to whichever opponent contributed the most positive
    // net Elo to `newKing` over their history up to `time`. No-op if no
    // opponent has a positive net contribution.
    const awardKingMaker = (newKing: string, time: number) => {
      const gains = netGainPerOpponent.get(newKing);
      if (!gains) return;
      let bestOpponent: string | null = null;
      let bestGain = 0;
      for (const [opponent, gain] of gains) {
        if (gain > bestGain) {
          bestGain = gain;
          bestOpponent = opponent;
        }
      }
      if (!bestOpponent) return;
      this.#addAchievement(
        bestOpponent,
        this.#createAchievement("king-maker", bestOpponent, time, {
          newKing,
          netScoreGained: bestGain,
        }),
      );
    };

    // Timestamp of each player's first game. Used as the "from" date
    // on throne / podium achievements so the display can show how
    // long it took the player to reach that rank.
    const firstGameAt = new Map<string, number>();

    // The player currently sitting at rank #1 in the leaderboard pool.
    // Updated AFTER each game / recheck — used as the "dethroned" field
    // when someone takes the throne next. Stays null until the first
    // time the pool has a ranked #1.
    let previousThroneHolder: string | null = null;

    // Highest-Elo ranked active player at `atTime`. Returns null if there
    // is no ranked active player.
    const computeRank1Holder = (atTime: number): string | null => {
      let best: { id: string; elo: number } | null = null;
      for (const [id, p] of playerMap) {
        if (p.totalGames < gameLimit) continue;
        if (!isActiveAt(id, atTime)) continue;
        if (!best || p.elo > best.elo) best = { id, elo: p.elo };
      }
      return best?.id ?? null;
    };

    // Climber tracking: each time a player is post-match ranked, lock
    // in their first-ranked Elo (and update the running low downward).
    // Award the achievement once when current Elo - low ≥ 300.
    const updateClimber = (playerId: string, currentElo: number, totalGames: number, time: number) => {
      if (totalGames < gameLimit) return;
      if (!isActiveAt(playerId, time)) return;
      const prevLow = this.climberAllTimeLow.get(playerId);
      if (prevLow === undefined || currentElo < prevLow.elo) {
        this.climberAllTimeLow.set(playerId, { elo: currentElo, time });
      }
      const low = this.climberAllTimeLow.get(playerId)!;
      if (currentElo - low.elo >= 300 && !climber.has(playerId)) {
        climber.add(playerId);
        this.#addAchievement(
          playerId,
          this.#createAchievement("climber", playerId, time, {
            fromElo: low.elo,
            toElo: currentElo,
            fromDate: low.time,
            toDate: time,
          }),
        );
      }
    };

    // When the leaderboard pool shifts (a player is deactivated or
    // reactivated, or the loser of a game drops below a non-participant)
    // the surviving active players may suddenly find themselves in top
    // 3 or at rank #1 without playing a match. Walk all currently active
    // ranked players at `time` and award any new throne / podium that
    // becomes earnable. The optional `skip` set lets the caller exclude
    // players whose own pre-match state should govern eligibility — used
    // by the per-game recheck so a winner/loser who just crossed
    // gameLimitForRanked doesn't sneak past the pre-match-ranked rule.
    const recheckRankAchievementsAt = (time: number, skip?: Set<string>) => {
      const rankedCount = countRankedAt(time);
      if (rankedCount < 5) return;
      for (const [playerId, player] of playerMap) {
        if (skip?.has(playerId)) continue;
        if (!isActiveAt(playerId, time)) continue;
        const rank = getRank(playerId, time);
        if (rank === null) continue;
        if (rank === 1 && !touchedThrone.has(playerId)) {
          touchedThrone.add(playerId);
          this.#addAchievement(
            playerId,
            this.#createAchievement("touched-the-throne", playerId, time, {
              elo: player.elo,
              firstGameAt: firstGameAt.get(playerId)!,
              dethroned:
                previousThroneHolder && previousThroneHolder !== playerId
                  ? previousThroneHolder
                  : undefined,
            }),
          );
          awardKingMaker(playerId, time);
        }
        if (rank <= 3 && !onPodium.has(playerId)) {
          onPodium.add(playerId);
          this.#addAchievement(
            playerId,
            this.#createAchievement("on-the-podium", playerId, time, {
              elo: player.elo,
              firstGameAt: firstGameAt.get(playerId)!,
            }),
          );
        }
      }
    };

    // Build a time-ordered action list of games + active-state changes.
    // Games at the same time as a state-change event are processed
    // first so the recheck sees the post-game state.
    type Action =
      | { kind: "game"; time: number; game: Game }
      | { kind: "recheck"; time: number };
    const actions: Action[] = [];
    for (const g of this.parent.games) {
      actions.push({ kind: "game", time: g.playedAt, game: g });
    }
    for (const e of this.parent.events) {
      if (e.type === EventTypeEnum.PLAYER_DEACTIVATED || e.type === EventTypeEnum.PLAYER_REACTIVATED) {
        actions.push({ kind: "recheck", time: e.time });
      }
    }
    actions.sort((a, b) => {
      if (a.time !== b.time) return a.time - b.time;
      if (a.kind === b.kind) return 0;
      return a.kind === "game" ? -1 : 1;
    });

    for (const action of actions) {
      if (action.kind === "recheck") {
        recheckRankAchievementsAt(action.time);
        previousThroneHolder = computeRank1Holder(action.time);
        continue;
      }
      const game = action.game;
      const winner = playerMap.get(game.winner);
      const loser = playerMap.get(game.loser);
      if (!winner || !loser) continue;

      if (!firstGameAt.has(game.winner)) firstGameAt.set(game.winner, game.playedAt);
      if (!firstGameAt.has(game.loser)) firstGameAt.set(game.loser, game.playedAt);

      // Pre-match ranks (loser's rank needed for Kingslayer; winner's for
      // Leap Frog's "from" rank).
      const winnerRankBefore = getRank(game.winner, game.playedAt);
      const loserRankBefore = getRank(game.loser, game.playedAt);
      const rankedCountBefore = countRankedAt(game.playedAt);

      // Kingslayer: loser was #1 going into the match. One-time per
      // player. Requires ≥5 ranked players so being "#1" actually means
      // outranking a real cohort, not a tiny pool.
      if (
        loserRankBefore === 1 &&
        rankedCountBefore >= 5 &&
        !kingslayed.has(game.winner)
      ) {
        kingslayed.add(game.winner);
        this.#addAchievement(
          game.winner,
          this.#createAchievement("kingslayer", game.winner, game.playedAt, {
            opponent: game.loser,
            gameId: game.id,
          }),
        );
      }

      // Apply Elo update.
      winner.totalGames++;
      loser.totalGames++;
      const winnerEloBefore = winner.elo;
      const loserEloBefore = loser.elo;
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(
        winner.elo,
        loser.elo,
        winner.totalGames,
        loser.totalGames,
      );
      winner.elo = winnersNewElo;
      loser.elo = losersNewElo;
      const eloGain = winnersNewElo - winnerEloBefore;

      // King Maker tracking: zero-sum Elo move feeds both players' maps.
      updateNetGain(game.winner, game.loser, eloGain);
      updateNetGain(game.loser, game.winner, -eloGain);

      // Update Climber tracking for both players (low + threshold check).
      updateClimber(game.winner, winner.elo, winner.totalGames, game.playedAt);
      updateClimber(game.loser, loser.elo, loser.totalGames, game.playedAt);

      // Post-match ranks.
      const winnerRankAfter = getRank(game.winner, game.playedAt);
      const loserRankAfter = getRank(game.loser, game.playedAt);
      const rankedCount = countRankedAt(game.playedAt);

      // Touched the Throne: first time the player ever sits at rank #1.
      // The player must already be ranked entering the match, and there
      // must be ≥5 ranked active players so "rank #1" is meaningful.
      if (
        winnerRankBefore !== null &&
        winnerRankAfter === 1 &&
        rankedCount >= 5 &&
        !touchedThrone.has(game.winner)
      ) {
        touchedThrone.add(game.winner);
        this.#addAchievement(
          game.winner,
          this.#createAchievement("touched-the-throne", game.winner, game.playedAt, {
            elo: winner.elo,
            firstGameAt: firstGameAt.get(game.winner)!,
            dethroned:
              previousThroneHolder && previousThroneHolder !== game.winner
                ? previousThroneHolder
                : undefined,
          }),
        );
        awardKingMaker(game.winner, game.playedAt);
      }
      if (
        loserRankBefore !== null &&
        loserRankAfter === 1 &&
        rankedCount >= 5 &&
        !touchedThrone.has(game.loser)
      ) {
        touchedThrone.add(game.loser);
        this.#addAchievement(
          game.loser,
          this.#createAchievement("touched-the-throne", game.loser, game.playedAt, {
            elo: loser.elo,
            firstGameAt: firstGameAt.get(game.loser)!,
            dethroned:
              previousThroneHolder && previousThroneHolder !== game.loser
                ? previousThroneHolder
                : undefined,
          }),
        );
        awardKingMaker(game.loser, game.playedAt);
      }

      // On the Podium: first time the player ever sits at rank ≤ 3 while
      // already being a ranked player. Requires ≥5 ranked active players.
      if (
        winnerRankBefore !== null &&
        winnerRankAfter !== null &&
        winnerRankAfter <= 3 &&
        rankedCount >= 5 &&
        !onPodium.has(game.winner)
      ) {
        onPodium.add(game.winner);
        this.#addAchievement(
          game.winner,
          this.#createAchievement("on-the-podium", game.winner, game.playedAt, {
            elo: winner.elo,
            firstGameAt: firstGameAt.get(game.winner)!,
          }),
        );
      }
      if (
        loserRankBefore !== null &&
        loserRankAfter !== null &&
        loserRankAfter <= 3 &&
        rankedCount >= 5 &&
        !onPodium.has(game.loser)
      ) {
        onPodium.add(game.loser);
        this.#addAchievement(
          game.loser,
          this.#createAchievement("on-the-podium", game.loser, game.playedAt, {
            elo: loser.elo,
            firstGameAt: firstGameAt.get(game.loser)!,
          }),
        );
      }

      // Leap Frog: awarded to a winner who jumps leaderboard ranks in a
      // single game and, in doing so, beats the league-wide record for the
      // biggest jump. Requires being ranked both before and after — a first
      // appearance on the leaderboard isn't a "jump". The first qualifying
      // jump of ≥ 2 ranks establishes the record; afterwards only a
      // strictly larger jump earns the award again.
      if (winnerRankBefore !== null && winnerRankAfter !== null) {
        const ranksJumped = winnerRankBefore - winnerRankAfter;
        // Track the winner's personal best jump for the progression view.
        if (ranksJumped > (this.bestRankJump.get(game.winner) ?? 0)) {
          this.bestRankJump.set(game.winner, ranksJumped);
        }
        const currentRecord = this.leapFrogRecord.ranksJumped;
        const beatsRecord =
          currentRecord === undefined ? ranksJumped >= 2 : ranksJumped > currentRecord;
        if (beatsRecord) {
          // Leapfrogged players: ranked active players whose pre-match Elo
          // was above the winner's pre-match Elo but who now sit below
          // the winner's post-match Elo. Only winner and loser had their
          // Elo change, so for everyone else pre = post = `other.elo`.
          const leapfroggedPlayers: string[] = [];
          for (const [otherId, other] of playerMap) {
            if (otherId === game.winner) continue;
            if (other.totalGames < gameLimit) continue;
            if (!isActiveAt(otherId, game.playedAt)) continue;
            const otherEloBefore = otherId === game.loser ? loserEloBefore : other.elo;
            if (otherEloBefore > winnerEloBefore && other.elo < winner.elo) {
              leapfroggedPlayers.push(otherId);
            }
          }
          this.#addAchievement(
            game.winner,
            this.#createAchievement("leap-frog", game.winner, game.playedAt, {
              opponent: game.loser,
              gameId: game.id,
              ranksJumped,
              fromRank: winnerRankBefore,
              toRank: winnerRankAfter,
              fromElo: winnerEloBefore,
              toElo: winner.elo,
              leapfroggedPlayers,
              previousRecord: currentRecord,
            }),
          );
          this.leapFrogRecord = { ranksJumped, holder: game.winner };
        }
      }

      // David: the league record for the biggest single-game Elo gain.
      // Goliath: mirror image — the record for the biggest single-game Elo
      // loss. Elo is zero-sum, so the loser's loss magnitude equals the
      // winner's gain and one game always sets (or beats) both records at
      // once. Both players must have been ranked at the time of playing the
      // match (pre-match ranks non-null) for the game to count. A swing of
      // UPSET_RECORD_FLOOR establishes the first record; after that only a
      // strictly bigger swing takes the records over.
      if (winnerRankBefore !== null && loserRankBefore !== null) {
        const prevBest = this.bestDavidGain.get(game.winner) ?? 0;
        if (eloGain > prevBest) {
          this.bestDavidGain.set(game.winner, eloGain);
        }
        const prevWorst = this.worstGoliathLoss.get(game.loser) ?? 0;
        if (eloGain > prevWorst) {
          this.worstGoliathLoss.set(game.loser, eloGain);
        }
        const currentUpsetRecord = this.davidRecord.eloGain;
        const beatsUpsetRecord =
          currentUpsetRecord === undefined ? eloGain >= UPSET_RECORD_FLOOR : eloGain > currentUpsetRecord;
        if (beatsUpsetRecord) {
          this.#addAchievement(
            game.winner,
            this.#createAchievement("david", game.winner, game.playedAt, {
              opponent: game.loser,
              gameId: game.id,
              eloGain,
              previousRecord: currentUpsetRecord,
            }),
          );
          this.#addAchievement(
            game.loser,
            this.#createAchievement("goliath", game.loser, game.playedAt, {
              opponent: game.winner,
              gameId: game.id,
              eloLoss: eloGain,
              previousRecord: this.goliathRecord.eloLoss,
            }),
          );
          this.davidRecord = { eloGain, holder: game.winner };
          this.goliathRecord = { eloLoss: eloGain, holder: game.loser };
        }
      }

      // Photo Finish: post-match Elos within 1 point. Both players must be
      // ranked — the achievement is awarded to both or neither (it's a
      // shared moment, not an individual one).
      const eloDiff = Math.abs(winner.elo - loser.elo);
      if (eloDiff <= 1 && winnerRankAfter !== null && loserRankAfter !== null) {
        this.#addAchievement(
          game.winner,
          this.#createAchievement("photo-finish", game.winner, game.playedAt, {
            opponent: game.loser,
            gameId: game.id,
            eloDiff,
            playerElo: winner.elo,
            opponentElo: loser.elo,
          }),
        );
        this.#addAchievement(
          game.loser,
          this.#createAchievement("photo-finish", game.loser, game.playedAt, {
            opponent: game.winner,
            gameId: game.id,
            eloDiff,
            playerElo: loser.elo,
            opponentElo: winner.elo,
          }),
        );
      }

      // Re-check non-participants. The loser's Elo drop can promote a
      // player who was at rank 4 into rank 3 (or the rank-1 player into
      // rank 2, demoting them); equally, a player crossing
      // gameLimitForRanked in this game can lift the ranked pool past
      // the ≥5 threshold and enable previously-blocked awards. The
      // winner and loser are excluded so their own pre-match-ranked
      // rule still governs.
      recheckRankAchievementsAt(game.playedAt, new Set([game.winner, game.loser]));

      previousThroneHolder = computeRank1Holder(game.playedAt);
    }
  }

  // Awards "Marathon Set" to the set winner for every set in this
  // game (evaluated in order) whose winning score strictly exceeds
  // the league-wide running record AND that was a true-deuce set
  // (winner ≥ 12, loser ≥ 10). Multiple awards from one game are
  // possible if successive sets each beat the running record.
  #checkMarathonSetAchievements(
    gameWinner: string,
    gameLoser: string,
    gameId: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
    playedAt: number,
  ) {
    setPoints.forEach((set) => {
      if (set.gameWinner === set.gameLoser) return;
      const setWinnerScore = Math.max(set.gameWinner, set.gameLoser);
      const setLoserScore = Math.min(set.gameWinner, set.gameLoser);
      if (setWinnerScore < 12 || setLoserScore < 10) return;
      const currentRecord = this.marathonSetRecord.score;
      if (currentRecord !== undefined && setWinnerScore <= currentRecord) return;

      const setWinnerId = set.gameWinner > set.gameLoser ? gameWinner : gameLoser;
      const setLoserId = setWinnerId === gameWinner ? gameLoser : gameWinner;

      this.#addAchievement(
        setWinnerId,
        this.#createAchievement("marathon-set", setWinnerId, playedAt, {
          gameId,
          opponent: setLoserId,
          setWinnerScore,
          setLoserScore,
          previousRecord: currentRecord,
        }),
      );

      this.marathonSetRecord = { score: setWinnerScore, holder: setWinnerId };
    });
  }

  // The Shootout score of a game: combined points of its
  // SHOOTOUT_SETS_COUNTED highest-scoring sets (all of them when the game
  // has fewer). Shared by the awarding pass and the progression view so the
  // two always agree.
  #shootoutScore(setPoints: { gameWinner: number; gameLoser: number }[]): number {
    return setPoints
      .map((set) => set.gameWinner + set.gameLoser)
      .sort((a, b) => b - a)
      .slice(0, SHOOTOUT_SETS_COUNTED)
      .reduce((sum, points) => sum + points, 0);
  }

  // Awards "Shootout" to BOTH players of a game whose Shootout score beats
  // the league-wide record — the points were scored together, so the record
  // is held together. A score of SHOOTOUT_RECORD_FLOOR establishes the first
  // record; after that only a strictly higher score takes it over.
  #checkShootoutAchievement(
    winner: string,
    loser: string,
    gameId: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
    playedAt: number,
  ) {
    const points = this.#shootoutScore(setPoints);

    // Track personal bests for the progression view.
    if (points > (this.bestShootout.get(winner) ?? 0)) this.bestShootout.set(winner, points);
    if (points > (this.bestShootout.get(loser) ?? 0)) this.bestShootout.set(loser, points);

    const currentRecord = this.shootoutRecord.points;
    const beatsRecord = currentRecord === undefined ? points >= SHOOTOUT_RECORD_FLOOR : points > currentRecord;
    if (!beatsRecord) return;

    // The counted sets — the SHOOTOUT_SETS_COUNTED highest-scoring ones
    // (earlier sets win ties), restored to game order for display.
    const countedSets = setPoints
      .map((set, index) => ({ set, index, sum: set.gameWinner + set.gameLoser }))
      .sort((a, b) => b.sum - a.sum || a.index - b.index)
      .slice(0, SHOOTOUT_SETS_COUNTED)
      .sort((a, b) => a.index - b.index)
      .map(({ set }) => set);

    this.#addAchievement(
      winner,
      this.#createAchievement("shootout", winner, playedAt, {
        gameId,
        opponent: loser,
        points,
        setsCounted: countedSets.length,
        sets: countedSets.map((set) => ({ playerPoints: set.gameWinner, opponentPoints: set.gameLoser })),
        previousRecord: currentRecord,
      }),
    );
    this.#addAchievement(
      loser,
      this.#createAchievement("shootout", loser, playedAt, {
        gameId,
        opponent: winner,
        points,
        setsCounted: countedSets.length,
        sets: countedSets.map((set) => ({ playerPoints: set.gameLoser, opponentPoints: set.gameWinner })),
        previousRecord: currentRecord,
      }),
    );
    this.shootoutRecord = { points, holders: [winner, loser] };
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

  #checkLessIsMoreAchievement(
    winner: string,
    loser: string,
    gameId: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
    playedAt: number,
  ) {
    const winnerPoints = setPoints.reduce((sum, set) => sum + set.gameWinner, 0);
    const loserPoints = setPoints.reduce((sum, set) => sum + set.gameLoser, 0);

    if (winnerPoints < loserPoints) {
      this.#addAchievement(
        winner,
        this.#createAchievement("less-is-more", winner, playedAt, {
          gameId,
          opponent: loser,
          playerPoints: winnerPoints,
          opponentPoints: loserPoints,
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

  #checkHatTrickAchievement(playerId: string, hatTrickWins: { playedAt: number }[], currentGameAt: number) {
    const NINETY_MINUTES = 90 * 60 * 1000;

    // Add current win to the list
    hatTrickWins.push({ playedAt: currentGameAt });

    // Remove wins older than 90 minutes from the current game
    const recentWins = hatTrickWins.filter((win) => currentGameAt - win.playedAt <= NINETY_MINUTES);

    // Update the array to only keep recent wins
    hatTrickWins.length = 0;
    hatTrickWins.push(...recentWins);

    // Check if player has 3 wins within 90 minutes
    if (recentWins.length === 3) {
      this.#addAchievement(
        playerId,
        this.#createAchievement("hat-trick", playerId, currentGameAt, {
          firstWinAt: recentWins[0].playedAt,
          thirdWinAt: currentGameAt,
        }),
      );

      // Reset the tracking after earning the achievement
      // This allows earning multiple hat-tricks in a row
      hatTrickWins.length = 0;
    }
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

  // Awards "Longest Win Streak" / "Longest Lose Streak" — the league-wide
  // records for consecutive wins and consecutive losses. Called with the
  // player's streak as it stands after the game just played.
  //
  // A streak takes the record the moment it passes the standing one (or
  // reaches STREAK_RECORD_FLOOR, when nobody holds it yet). Extending that
  // same streak while still holding the record does not award again — the
  // achievement already earned grows with the streak instead, so an
  // 11th straight win reads as one award worth 11 rather than two worth
  // 10 and 11. Its `earnedAt` moves to the game that extended it, so the
  // award always spans the whole of the record streak.
  //
  // Being overtaken mid-streak resets that: once another player holds the
  // record, passing them again earns a second award, and the first keeps
  // the length it had while it was the record. A streak that has been
  // broken always earns its own award when it takes the record back.
  //
  // Returns the award this streak now owns, to be stored on the player's
  // tracker and passed back in on their next game.
  #checkStreakRecordAchievement(
    type: "longest-win-streak" | "longest-lose-streak",
    record: { length: number | undefined; holder: string | undefined },
    playerId: string,
    streakLength: number,
    startedAt: number,
    playedAt: number,
    openRecord: StreakRecordAchievement | undefined,
  ): StreakRecordAchievement | undefined {
    const beatsRecord =
      record.length === undefined ? streakLength >= STREAK_RECORD_FLOOR : streakLength > record.length;
    if (!beatsRecord) {
      return openRecord;
    }

    // Same streak, still the record holder: grow the award instead of
    // handing out another one.
    if (openRecord !== undefined && record.holder === playerId) {
      openRecord.data.streakLength = streakLength;
      openRecord.earnedAt = playedAt;
      record.length = streakLength;
      return openRecord;
    }

    const data = { streakLength, startedAt, previousRecord: record.length };
    const achievement: StreakRecordAchievement =
      type === "longest-win-streak"
        ? this.#createAchievement("longest-win-streak", playerId, playedAt, data)
        : this.#createAchievement("longest-lose-streak", playerId, playedAt, data);
    this.#addAchievement(playerId, achievement);
    record.length = streakLength;
    record.holder = playerId;
    return achievement;
  }

  // Local midnight of the day containing `ms`.
  #dayStartOf(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // Local Monday-midnight of the week containing `ms` (matching Perfect Week).
  #weekStartOf(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    const daysSinceMonday = (d.getDay() + 6) % 7; // getDay: 0=Sun..6=Sat
    d.setDate(d.getDate() - daysSinceMonday);
    return d.getTime();
  }

  // Local midnight of the 1st of the month containing `ms`.
  #monthStartOf(ms: number): number {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  // Hero of the Day / Week / Month: the league-wide records for most games by
  // one player in a single local calendar day / week / month. All three work
  // like the streak records: the first period to reach the record floor
  // establishes the record, after that only playing more games in one period
  // than the record takes it. While the record holder keeps playing in their
  // record period the award grows with the period instead of handing out one
  // per game; once the period ends (or someone else takes the record over) a
  // later run is a fresh chase. The three periods run independently — a busy
  // record day also feeds that week's and month's counts.
  #checkHeroAchievements(
    playerId: string,
    tracker: { heroOfTheDay: HeroPeriodState; heroOfTheWeek: HeroPeriodState; heroOfTheMonth: HeroPeriodState },
    playedAt: number,
  ) {
    this.#checkHeroRecordAchievement(
      "hero-of-the-day",
      playerId,
      tracker.heroOfTheDay,
      this.gamesInDayRecord,
      this.#dayStartOf(playedAt),
      playedAt,
    );
    this.#checkHeroRecordAchievement(
      "hero-of-the-week",
      playerId,
      tracker.heroOfTheWeek,
      this.gamesInWeekRecord,
      this.#weekStartOf(playedAt),
      playedAt,
    );
    this.#checkHeroRecordAchievement(
      "hero-of-the-month",
      playerId,
      tracker.heroOfTheMonth,
      this.gamesInMonthRecord,
      this.#monthStartOf(playedAt),
      playedAt,
    );
  }

  #checkHeroRecordAchievement(
    type: "hero-of-the-day" | "hero-of-the-week" | "hero-of-the-month",
    playerId: string,
    state: HeroPeriodState,
    record: { count: number | undefined; holder: string | undefined },
    periodStart: number,
    playedAt: number,
  ) {
    if (state.periodStart !== periodStart) {
      state.periodStart = periodStart;
      state.gamesInPeriod = 0;
      state.openRecord = undefined;
    }
    state.gamesInPeriod++;

    const beatsRecord =
      record.count === undefined
        ? state.gamesInPeriod >= GAMES_IN_PERIOD_RECORD_FLOOR
        : state.gamesInPeriod > record.count;
    if (!beatsRecord) {
      return;
    }

    // Same period, still the record holder: grow the award instead of handing
    // out another one.
    if (state.openRecord !== undefined && record.holder === playerId) {
      state.openRecord.data.gamesPlayed = state.gamesInPeriod;
      state.openRecord.earnedAt = playedAt;
      record.count = state.gamesInPeriod;
      return;
    }

    const gamesPlayed = state.gamesInPeriod;
    const previousRecord = record.count;
    let achievement: HeroRecordAchievement;
    if (type === "hero-of-the-day") {
      achievement = this.#createAchievement("hero-of-the-day", playerId, playedAt, {
        day: periodStart,
        gamesPlayed,
        previousRecord,
      });
    } else if (type === "hero-of-the-week") {
      achievement = this.#createAchievement("hero-of-the-week", playerId, playedAt, {
        weekStart: periodStart,
        gamesPlayed,
        previousRecord,
      });
    } else {
      achievement = this.#createAchievement("hero-of-the-month", playerId, playedAt, {
        monthStart: periodStart,
        gamesPlayed,
        previousRecord,
      });
    }
    this.#addAchievement(playerId, achievement);
    record.count = gamesPlayed;
    record.holder = playerId;
    state.openRecord = achievement;
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

  // The calendar date of a player's `year`-th anniversary: the same month and
  // day as their first ever game, `year` years later. Returned at local
  // midnight (matching the seasons logic, which also works in local time).
  #anniversaryDate(firstActiveAt: number, year: number): Date {
    const date = new Date(firstActiveAt);
    date.setHours(0, 0, 0, 0);
    date.setFullYear(date.getFullYear() + year);
    return date;
  }

  // Whole calendar days between two instants (local time). Both are floored to
  // local midnight first; Math.round absorbs DST days that are 23 or 25 hours.
  #calendarDayDiff(aMs: number, bMs: number): number {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const a = new Date(aMs);
    a.setHours(0, 0, 0, 0);
    const b = new Date(bMs);
    b.setHours(0, 0, 0, 0);
    return Math.round((a.getTime() - b.getTime()) / ONE_DAY);
  }

  // Awards "Anniversary" when a player plays a game around a yearly mark of
  // their first ever game (1 year, 2 years, ...). The game qualifies as long as
  // it lands on the calendar date before the anniversary, on the anniversary
  // date itself, or the date after — at any time of day. Earnable once per
  // year mark.
  #checkAnniversaryAchievement(playerId: string, firstActiveAt: number, currentGameAt: number) {
    const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

    // Which whole-year anniversary is this game closest to? A few days of
    // leap-year drift stays far below half a year, so rounding is unambiguous.
    const year = Math.round((currentGameAt - firstActiveAt) / ONE_YEAR);
    if (year < 1) {
      return;
    }
    const anniversaryDate = this.#anniversaryDate(firstActiveAt, year);
    if (Math.abs(this.#calendarDayDiff(currentGameAt, anniversaryDate.getTime())) > 1) {
      return;
    }

    const alreadyEarned = this.getAchievements(playerId).some(
      (a) => a.type === "anniversary" && a.data.year === year,
    );
    if (alreadyEarned) {
      return;
    }

    this.#addAchievement(
      playerId,
      this.#createAchievement("anniversary", playerId, currentGameAt, { firstGameAt: firstActiveAt, year }),
    );
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
      const tournamentId = t.tournamentConfig.id;

      // Only award participation if the tournament has started
      if (t.tournamentConfig.startDate > Date.now()) return;

      // Check participation for all players in the tournament
      t.tournamentConfig.playerOrder?.forEach((playerId) => {
        this.#addAchievement(
          playerId,
          this.#createAchievement("tournament-participated", playerId, t.tournamentConfig.startDate, {
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

      // Check for Group Stage Star: a player who finished their group stage
      // with zero losses and zero own-skips (opponent skips that gave them a
      // free win still count). Awarded once per tournament group stage.
      if (t.groupPlay && t.groupPlay.groupPlayEnded !== undefined) {
        const endedAt = t.groupPlay.groupPlayEnded;
        t.groupPlay.groupScores.forEach((score, playerId) => {
          if (score.loss === 0 && score.skips === 0 && score.wins > 0) {
            this.#addAchievement(
              playerId,
              this.#createAchievement("group-stage-star", playerId, endedAt, {
                tournamentId,
                wins: score.wins,
              }),
            );
          }
        });
      }
    });
  }

  #checkSeasonAchievements() {
    this.parent.seasons.getSeasons().forEach((s) => {
      const leaderboard = s.getLeaderboard();

      // Check participation TODO

      // Season Opener: both players of the season's very first game earned
      // it the moment they opened the season — no need to wait for the
      // season to end. Seasons only exist once they contain a game, and
      // their games arrive in time order, so the first entry is the opener.
      const openingGame = s.games[0];
      if (openingGame) {
        this.#addAchievement(
          openingGame.winner,
          this.#createAchievement("season-opener", openingGame.winner, openingGame.playedAt, {
            seasonStart: s.start,
            gameId: openingGame.id,
            opponent: openingGame.loser,
          }),
        );
        this.#addAchievement(
          openingGame.loser,
          this.#createAchievement("season-opener", openingGame.loser, openingGame.playedAt, {
            seasonStart: s.start,
            gameId: openingGame.id,
            opponent: openingGame.winner,
          }),
        );
      }

      // Check for season winners
      if (Date.now() > s.end && leaderboard.length > 0) {
        const winner = leaderboard[0].playerId;
        this.#addAchievement(winner, this.#createAchievement("season-winner", winner, s.end, { seasonStart: s.start }));
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

  // Awards the "Earliest Game" and "Latest Game" record-breaking achievements.
  // The time-of-day is derived in the browser's local timezone: 00:00 is the
  // earliest possible and 23:59 the latest. When a game strictly beats the
  // running earliest / latest record it is awarded to BOTH players. The very
  // first game only seeds the records (no prior record exists to break).
  #checkTimeOfDayAchievements(game: Game) {
    const playedDate = new Date(game.playedAt);
    const minutesIntoDay = playedDate.getHours() * 60 + playedDate.getMinutes();
    const time = `${String(playedDate.getHours()).padStart(2, "0")}:${String(playedDate.getMinutes()).padStart(2, "0")}`;

    // Earliest Game
    if (this.earliestGameRecord.minutesIntoDay === undefined) {
      this.earliestGameRecord.minutesIntoDay = minutesIntoDay;
    } else if (minutesIntoDay < this.earliestGameRecord.minutesIntoDay) {
      this.earliestGameRecord.minutesIntoDay = minutesIntoDay;
      this.#addAchievement(
        game.winner,
        this.#createAchievement("earliest-game", game.winner, game.playedAt, {
          gameId: game.id,
          opponent: game.loser,
          time,
          minutesIntoDay,
        }),
      );
      this.#addAchievement(
        game.loser,
        this.#createAchievement("earliest-game", game.loser, game.playedAt, {
          gameId: game.id,
          opponent: game.winner,
          time,
          minutesIntoDay,
        }),
      );
    }

    // Latest Game
    if (this.latestGameRecord.minutesIntoDay === undefined) {
      this.latestGameRecord.minutesIntoDay = minutesIntoDay;
    } else if (minutesIntoDay > this.latestGameRecord.minutesIntoDay) {
      this.latestGameRecord.minutesIntoDay = minutesIntoDay;
      this.#addAchievement(
        game.winner,
        this.#createAchievement("latest-game", game.winner, game.playedAt, {
          gameId: game.id,
          opponent: game.loser,
          time,
          minutesIntoDay,
        }),
      );
      this.#addAchievement(
        game.loser,
        this.#createAchievement("latest-game", game.loser, game.playedAt, {
          gameId: game.id,
          opponent: game.winner,
          time,
          minutesIntoDay,
        }),
      );
    }
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
    const gameLimitForRanked = this.parent.client.gameLimitForRanked;

    // The key order here is the order achievements appear in the player's
    // Progress tab (which iterates this object). Grouped by theme, and within
    // each group ordered easiest → hardest.
    const progression: AchievementProgression = {
      // Getting started
      "first-game": { current: 0, target: 1, earned: 0 },
      "ranked": { current: 0, target: gameLimitForRanked, earned: 0 },

      // Win streaks
      "streak-all-10": { current: 0, target: 10, earned: 0 },
      "streak-player-10": { current: 0, target: 10, perOpponent: new Map(), earned: 0 },
      "streak-player-20": { current: 0, target: 20, perOpponent: new Map(), earned: 0 },
      "hat-trick": { current: 0, target: 3, earned: 0 },
      "perfect-day": { current: 0, target: 5, earned: 0 },
      "perfect-week": { current: 0, target: 5, earned: 0 },
      "streak-ender": { earned: 0 },
      // Record-chasing achievements are earned by strictly exceeding the
      // league record, so their target is one beyond it — reaching the
      // target is what earns the award, same as every other progress bar.
      "longest-win-streak": {
        earned: 0,
        current: 0,
        personalBest: 0,
        target: this.winStreakRecord.length === undefined ? undefined : this.winStreakRecord.length + 1,
        recordHolder: this.winStreakRecord.holder,
      },

      // Resilience
      "punching-bag": { current: 0, target: 10, earned: 0 },
      "never-give-up": { current: 0, target: 20, earned: 0 },
      "comeback-kid": { earned: 0 },
      "unbreakable-spirit": { earned: 0 },
      "longest-lose-streak": {
        earned: 0,
        current: 0,
        personalBest: 0,
        target: this.loseStreakRecord.length === undefined ? undefined : this.loseStreakRecord.length + 1,
        recordHolder: this.loseStreakRecord.holder,
      },

      // Rank & Score
      "on-the-podium": { earned: 0 },
      "touched-the-throne": { earned: 0 },
      "kingslayer": { earned: 0 },
      "king-maker": { earned: 0 },
      "leap-frog": {
        earned: 0,
        current: 0,
        target: this.leapFrogRecord.ranksJumped === undefined ? undefined : this.leapFrogRecord.ranksJumped + 1,
        recordHolder: this.leapFrogRecord.holder,
      },
      // David / Goliath chase a fractional Elo record, so unlike the integer
      // records the target IS the record — it must be strictly exceeded.
      "david": {
        earned: 0,
        current: 0,
        target: this.davidRecord.eloGain,
        recordHolder: this.davidRecord.holder,
      },
      "goliath": {
        earned: 0,
        current: 0,
        target: this.goliathRecord.eloLoss,
        recordHolder: this.goliathRecord.holder,
      },
      "climber": { current: 0, target: 300, earned: 0 },
      "full-house": { current: 0, target: 1, missing: new Set(), earned: 0 },
      "humbled": { current: 0, target: 1, missing: new Set(), earned: 0 },

      // Game feats
      "donut-1": { current: 0, target: 1, earned: 0 },
      "donut-5": { current: 0, target: 5, earned: 0 },
      "nice-game": { earned: 0 },
      "less-is-more": { earned: 0 },
      "close-calls": { current: 0, target: 5, earned: 0 },
      "edge-lord": { current: 0, target: 20, earned: 0 },
      "consistency-is-key": { current: 0, target: 5, earned: 0 },
      "photo-finish": { earned: 0 },
      "marathon-set": {
        earned: 0,
        current: 0,
        target: this.marathonSetRecord.score === undefined ? undefined : this.marathonSetRecord.score + 1,
        recordHolder: this.marathonSetRecord.holder,
      },
      "shootout": {
        earned: 0,
        current: 0,
        target: this.shootoutRecord.points === undefined ? undefined : this.shootoutRecord.points + 1,
        recordHolders: this.shootoutRecord.holders,
      },
      "hero-of-the-day": {
        earned: 0,
        current: 0,
        personalBest: 0,
        target: this.gamesInDayRecord.count === undefined ? undefined : this.gamesInDayRecord.count + 1,
        recordHolder: this.gamesInDayRecord.holder,
      },
      "hero-of-the-week": {
        earned: 0,
        current: 0,
        personalBest: 0,
        target: this.gamesInWeekRecord.count === undefined ? undefined : this.gamesInWeekRecord.count + 1,
        recordHolder: this.gamesInWeekRecord.holder,
      },
      "hero-of-the-month": {
        earned: 0,
        current: 0,
        personalBest: 0,
        target: this.gamesInMonthRecord.count === undefined ? undefined : this.gamesInMonthRecord.count + 1,
        recordHolder: this.gamesInMonthRecord.holder,
      },
      // Record-breaking, no progress bar. recordMinutes is the current league
      // record; playerMinutes (the player's own best) is filled in below.
      "earliest-game": { earned: 0, recordMinutes: this.earliestGameRecord.minutesIntoDay },
      "latest-game": { earned: 0, recordMinutes: this.latestGameRecord.minutesIntoDay },

      // Social
      "variety-player": { current: 0, target: 10, opponents: new Set(), earned: 0 },
      "global-player": { current: 0, target: 20, opponents: new Set(), earned: 0 },
      "best-friends": { current: 0, target: 50, perOpponent: new Map(), earned: 0 },
      "welcome-committee": { current: 0, target: 3, newPlayers: new Set(), earned: 0 },
      "community-builder": { current: 0, target: 10, newPlayers: new Set(), earned: 0 },

      // Loyalty & activity
      "active-6-months": { current: 0, target: SIX_MONTHS, earned: 0 },
      "active-1-year": { current: 0, target: ONE_YEAR, earned: 0 },
      "active-2-years": { current: 0, target: TWO_YEARS, earned: 0 },
      // Target is the one-year mark of the first game; current is how much of
      // that year has elapsed. When current reaches target the player is at
      // their anniversary and playing a game awards it (on the day before, day
      // of, or day after the anniversary date).
      "anniversary": { current: 0, target: ONE_YEAR, earned: 0 },
      "back-after-6-months": { earned: 0, target: SIX_MONTHS },
      "back-after-1-year": { earned: 0, target: ONE_YEAR },
      "back-after-2-years": { earned: 0, target: TWO_YEARS },
      "retired": { earned: 0 },
      // A two-step chase: retire, then come back. A currently retired player
      // is halfway there; current is filled in below.
      "back-from-the-dead": { current: 0, target: 2, earned: 0 },

      // Competition
      "tournament-participated": { earned: 0 },
      "tournament-winner": { earned: 0 },
      "group-stage-star": { earned: 0 },
      "season-winner": { current: 0, target: 1, earned: 0 },
      "season-opener": { earned: 0 },
      "milestone-game": { current: 0, target: 100, earned: 0 },
    };

    let firstActiveAt: number | null = null;
    let lastActiveAt: number | null = null;
    let gamesPlayedCount = 0;
    let currentWinStreakAll = 0;
    let currentLoseStreakAll = 0;
    // Longest runs the player has ever put together, which may be longer than
    // the streak they are on now. Shown alongside the league streak records.
    let longestWinStreakAll = 0;
    let longestLoseStreakAll = 0;
    let donutCount = 0;
    let closeCallsCount = 0;
    let edgeLordCount = 0;
    let consistencyCount = 0;
    let bestDeuceSetWon = 0;
    const streaksPerOpponent = new Map<string, number>();
    // Perfect Day progression: wins / losses grouped by local calendar day.
    const perfectDayStats = new Map<number, { wins: number; losses: number }>();
    // Hero of the Week / Month progression: the player's games per local
    // calendar week / month, keyed by the period's start timestamp.
    const gamesPerWeek = new Map<number, number>();
    const gamesPerMonth = new Map<number, number>();
    // Perfect Week progression: distinct won days (offsets from Monday,
    // 0=Mon..6=Sun) per week — any day can be part of a 5-day run.
    const perfectWeekDaysWon = new Map<number, Set<number>>();
    const opponentsPlayed = new Set<string>();
    const gamesPerOpponent = new Map<string, { count: number; firstGame: number; lastGame: number }>();
    const firstOpponentForSet = new Set<string>();

    // Track first games for each player to determine who was their first opponent
    const playerFirstGames = new Map<string, { opponent: string; timestamp: number }>();

    // This player's own earliest / latest time-of-day (minutes past local
    // midnight, browser timezone) across all their games — used to show how
    // far they are from the Earliest / Latest Game league records.
    let playerEarliestMinutes: number | undefined = undefined;
    let playerLatestMinutes: number | undefined = undefined;

    this.parent.games.forEach((game) => {
      // Track first opponent for each player
      if (!playerFirstGames.has(game.winner)) {
        playerFirstGames.set(game.winner, { opponent: game.loser, timestamp: game.playedAt });
      }
      if (!playerFirstGames.has(game.loser)) {
        playerFirstGames.set(game.loser, { opponent: game.winner, timestamp: game.playedAt });
      }

      // Track this player's own earliest / latest time-of-day.
      if (game.winner === playerId || game.loser === playerId) {
        const playedDate = new Date(game.playedAt);
        const minutesIntoDay = playedDate.getHours() * 60 + playedDate.getMinutes();
        if (playerEarliestMinutes === undefined || minutesIntoDay < playerEarliestMinutes) {
          playerEarliestMinutes = minutesIntoDay;
        }
        if (playerLatestMinutes === undefined || minutesIntoDay > playerLatestMinutes) {
          playerLatestMinutes = minutesIntoDay;
        }
      }
    });

    progression["earliest-game"].playerMinutes = playerEarliestMinutes;
    progression["latest-game"].playerMinutes = playerLatestMinutes;

    // Count how many players have this playerId as their first opponent
    playerFirstGames.forEach((firstGame, player) => {
      if (firstGame.opponent === playerId) {
        firstOpponentForSet.add(player);
      }
    });

    progression["welcome-committee"].current = firstOpponentForSet.size;
    progression["welcome-committee"].newPlayers = firstOpponentForSet;
    progression["community-builder"].current = firstOpponentForSet.size;
    progression["community-builder"].newPlayers = firstOpponentForSet;

    // Calculate current stats by iterating through games
    this.parent.games.forEach((game) => {
      const isWinner = game.winner === playerId;
      const isLoser = game.loser === playerId;

      if (!isWinner && !isLoser) return;

      gamesPlayedCount++;

      // Track first active time
      if (firstActiveAt === null) {
        firstActiveAt = game.playedAt;
      }

      // Track last active time
      lastActiveAt = game.playedAt;

      // Perfect Day progression: tally wins / losses per local calendar day.
      const dayStart = new Date(game.playedAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayKey = dayStart.getTime();
      let dayStat = perfectDayStats.get(dayKey);
      if (!dayStat) {
        dayStat = { wins: 0, losses: 0 };
        perfectDayStats.set(dayKey, dayStat);
      }
      if (isWinner) {
        dayStat.wins++;
      } else {
        dayStat.losses++;
      }

      // Hero of the Week / Month progression: tally games per week / month.
      const heroWeekKey = this.#weekStartOf(game.playedAt);
      gamesPerWeek.set(heroWeekKey, (gamesPerWeek.get(heroWeekKey) ?? 0) + 1);
      const heroMonthKey = this.#monthStartOf(game.playedAt);
      gamesPerMonth.set(heroMonthKey, (gamesPerMonth.get(heroMonthKey) ?? 0) + 1);

      // Perfect Week progression: collect distinct won days per week.
      if (isWinner) {
        const weekDate = new Date(game.playedAt);
        weekDate.setHours(0, 0, 0, 0);
        const wonDayOffset = (weekDate.getDay() + 6) % 7; // 0=Mon..6=Sun
        weekDate.setDate(weekDate.getDate() - wonDayOffset);
        const weekKey = weekDate.getTime();
        let daysWon = perfectWeekDaysWon.get(weekKey);
        if (!daysWon) {
          daysWon = new Set();
          perfectWeekDaysWon.set(weekKey, daysWon);
        }
        daysWon.add(wonDayOffset);
      }

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
        longestWinStreakAll = Math.max(longestWinStreakAll, currentWinStreakAll);

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
        longestLoseStreakAll = Math.max(longestLoseStreakAll, currentLoseStreakAll);

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

      // Track highest deuce-set winning score this player has won
      // (regardless of overall game outcome — the achievement is
      // awarded to set winners).
      if (game.score?.setPoints) {
        game.score.setPoints.forEach((set) => {
          if (set.gameWinner === set.gameLoser) return;
          const setWinnerScore = Math.max(set.gameWinner, set.gameLoser);
          const setLoserScore = Math.min(set.gameWinner, set.gameLoser);
          if (setWinnerScore < 12 || setLoserScore < 10) return;
          const setWinnerIsGameWinner = set.gameWinner > set.gameLoser;
          const playerWonSet =
            (isWinner && setWinnerIsGameWinner) || (isLoser && !setWinnerIsGameWinner);
          if (playerWonSet && setWinnerScore > bestDeuceSetWon) {
            bestDeuceSetWon = setWinnerScore;
          }
        });
      }
    });

    // Update progression with current stats
    // "Ranked" progress is the games played toward the ranked threshold,
    // capped at the target so it never exceeds 100% once earned — going
    // beyond would leak the player's total games count.
    progression["first-game"].current = Math.min(gamesPlayedCount, 1);
    progression["ranked"].current = Math.min(gamesPlayedCount, gameLimitForRanked);
    progression["donut-1"].current = donutCount;
    progression["donut-5"].current = donutCount;
    progression["streak-all-10"].current = currentWinStreakAll;
    progression["close-calls"].current = closeCallsCount;
    progression["edge-lord"].current = edgeLordCount;
    progression["consistency-is-key"].current = consistencyCount;
    progression["marathon-set"].current = bestDeuceSetWon;
    progression["variety-player"].current = opponentsPlayed.size;
    progression["variety-player"].opponents = opponentsPlayed;
    progression["global-player"].current = opponentsPlayed.size;
    progression["global-player"].opponents = opponentsPlayed;
    progression["punching-bag"].current = currentLoseStreakAll;
    progression["never-give-up"].current = currentLoseStreakAll;

    // Longest Win / Lose Streak: the live streak is what can still grow into
    // the league record, so that is the progress. The player's longest ever
    // run is reported alongside it.
    progression["longest-win-streak"].current = currentWinStreakAll;
    progression["longest-win-streak"].personalBest = longestWinStreakAll;
    progression["longest-lose-streak"].current = currentLoseStreakAll;
    progression["longest-lose-streak"].personalBest = longestLoseStreakAll;

    // Perfect Day progression tracks TODAY's live attempt: the number of
    // games won today with zero losses so far. A single loss today nullifies
    // it — progress drops to 0 and the player must try again tomorrow. No
    // games today → 0. A full 5/5 today reads as complete but is not yet
    // earned: the achievement lands when the day ends still undefeated.
    const nowMs = Date.now();
    const todayStart = new Date(nowMs);
    todayStart.setHours(0, 0, 0, 0);
    const todayStat = perfectDayStats.get(todayStart.getTime());
    progression["perfect-day"].current =
      todayStat && todayStat.losses === 0 ? Math.min(todayStat.wins, 5) : 0;

    // Hero of the Day / Week / Month: only the current period's games can
    // still grow into the record, so that is the progress. The player's
    // busiest period ever is reported alongside it.
    progression["hero-of-the-day"].current = todayStat ? todayStat.wins + todayStat.losses : 0;
    let busiestDay = 0;
    perfectDayStats.forEach((stats) => {
      busiestDay = Math.max(busiestDay, stats.wins + stats.losses);
    });
    progression["hero-of-the-day"].personalBest = busiestDay;

    progression["hero-of-the-week"].current = gamesPerWeek.get(this.#weekStartOf(nowMs)) ?? 0;
    let busiestWeek = 0;
    gamesPerWeek.forEach((count) => {
      busiestWeek = Math.max(busiestWeek, count);
    });
    progression["hero-of-the-week"].personalBest = busiestWeek;

    progression["hero-of-the-month"].current = gamesPerMonth.get(this.#monthStartOf(nowMs)) ?? 0;
    let busiestMonth = 0;
    gamesPerMonth.forEach((count) => {
      busiestMonth = Math.max(busiestMonth, count);
    });
    progression["hero-of-the-month"].personalBest = busiestMonth;

    // Perfect Week progression tracks THIS week's live attempt: of the three
    // possible 5-consecutive-day runs (Mon–Fri, Tue–Sat, Wed–Sun), the most
    // won days in a run that can still be completed. A run is dead once any
    // of its days has fully elapsed without a win; today and future days are
    // still winnable and simply count 0 until won. E.g. a Monday win reads
    // 1/5 all through Tuesday; if Tuesday then passes with no win, the
    // Mon–Fri and Tue–Sat runs are dead and Wednesday starts the player on
    // the Wed–Sun run at 0/5.
    const weekStartNow = new Date(nowMs);
    weekStartNow.setHours(0, 0, 0, 0);
    const daysSinceMonday = (weekStartNow.getDay() + 6) % 7; // 0=Mon..6=Sun
    weekStartNow.setDate(weekStartNow.getDate() - daysSinceMonday);
    const daysWonThisWeek = perfectWeekDaysWon.get(weekStartNow.getTime()) ?? new Set<number>();
    let perfectWeekProgress = 0;
    for (let start = 0; start <= 2; start++) {
      let runIsDead = false;
      let daysWonInRun = 0;
      for (let offset = start; offset < start + 5; offset++) {
        if (daysWonThisWeek.has(offset)) {
          daysWonInRun++;
        } else if (offset < daysSinceMonday) {
          runIsDead = true;
          break;
        }
      }
      if (!runIsDead) {
        perfectWeekProgress = Math.max(perfectWeekProgress, daysWonInRun);
      }
    }
    progression["perfect-week"].current = perfectWeekProgress;

    // Calculate hat-trick progression (wins within last 90 minutes)
    const NINETY_MINUTES = 90 * 60 * 1000;
    const currentTime = Date.now();
    const recentWins: number[] = [];

    // Iterate through games in reverse to find recent wins
    for (let i = this.parent.games.length - 1; i >= 0; i--) {
      const game = this.parent.games[i];
      if (game.winner === playerId && currentTime - game.playedAt <= NINETY_MINUTES) {
        recentWins.push(game.playedAt);
      } else if (game.winner === playerId || game.loser === playerId) {
        // Stop when we hit a game outside the 90-minute window
        if (currentTime - game.playedAt > NINETY_MINUTES) {
          break;
        }
      }
    }

    progression["hat-trick"].current = recentWins.length;


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

    // Set current to max under target, or 0 if all are at/over the target
    progression["streak-player-10"].current = maxStreakUnder10;
    progression["streak-player-20"].current = maxStreakUnder20;

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

    // Anniversary progress counts toward the next anniversary the player can
    // still earn, and resets to 0 each year. The "target year" is the earliest
    // whole year that has neither been earned nor had its window pass (now is
    // more than one calendar day after the anniversary date). Progress is the
    // time elapsed since the start of that year's cycle (the previous
    // anniversary, or the first game).
    if (firstActiveAt !== null) {
      const now = Date.now();
      const earnedYears = new Set<number>();
      for (const achievement of this.getAchievements(playerId)) {
        if (achievement.type === "anniversary") {
          earnedYears.add(achievement.data.year);
        }
      }

      let targetYear = 1;
      while (
        earnedYears.has(targetYear) ||
        this.#calendarDayDiff(now, this.#anniversaryDate(firstActiveAt, targetYear).getTime()) > 1
      ) {
        targetYear++;
      }

      const cycleStart = firstActiveAt + (targetYear - 1) * ONE_YEAR;
      progression["anniversary"].current = Math.max(0, now - cycleStart);
      progression["anniversary"].target = ONE_YEAR;
      progression["anniversary"].firstGameAt = firstActiveAt;
    }

    // Back From The Dead progression: a currently retired player has done
    // step one of two — the comeback is all that's left, so they sit at 50%.
    // An active player (back or never gone) is at the start of the chase.
    const isCurrentlyRetired =
      this.parent.allPlayers.some((player) => player.id === playerId) &&
      !this.parent.players.some((player) => player.id === playerId);
    progression["back-from-the-dead"].current = isCurrentlyRetired ? 1 : 0;

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

    // Season progress
    const seasons = this.parent.seasons.getSeasons();
    const latestSeason = seasons[seasons.length - 1];
    if (latestSeason && Date.now() > latestSeason.start && Date.now() < latestSeason.end) {
      const leaderboard = latestSeason.getLeaderboard();
      const leadersScore = leaderboard[0].seasonScore;
      progression["season-winner"].target = leadersScore;

      const player = leaderboard.find((p) => p.playerId === playerId);
      if (player) {
        progression["season-winner"].current = player.seasonScore;
      }
    }

    // David progression: highest Elo gained from a win where both
    // players were ranked at the time of the match. Players who never
    // crossed the ranked threshold will naturally have no entries in
    // bestDavidGain; deactivated players who earned qualifying gains
    // while active keep their progression here.
    progression["david"].current = this.bestDavidGain.get(playerId) ?? 0;

    // Leap Frog progression: the player's own biggest single-game
    // leaderboard jump (ranked before and after), compared against the
    // league record they must strictly exceed to earn the award.
    progression["leap-frog"].current = this.bestRankJump.get(playerId) ?? 0;

    // Goliath progression: largest Elo lost from a single match where
    // both players were ranked at the time. Mirrors David — deactivated
    // players who suffered qualifying losses while ranked keep their
    // progression here.
    progression["goliath"].current = this.worstGoliathLoss.get(playerId) ?? 0;

    // Shootout progression: the player's own highest Shootout score (combined
    // points of a game's highest-scoring sets), compared against the league
    // record they must strictly exceed to earn the award.
    progression["shootout"].current = this.bestShootout.get(playerId) ?? 0;

    // Milestone Game progression is league-wide (everyone shares it) and
    // restarts at every milestone: current is the games played since the
    // previous milestone (0 right after one) and target is the 500-game
    // interval, so the bar gauges how close the next milestone game is —
    // target - current games remain. Deleted games are already gone from
    // parent.games, so they don't count.
    progression["milestone-game"].current = this.parent.games.length % MILESTONE_GAME_INTERVAL;
    progression["milestone-game"].target = MILESTONE_GAME_INTERVAL;

    // Climber progression: current Elo - all-time low Elo since the
    // player first became ranked. Players who never became ranked have
    // no recorded low → progression stays at 0.
    const climberLow = this.climberAllTimeLow.get(playerId);
    if (climberLow !== undefined) {
      const currentElo = this.parent.leaderboard.getPlayerSummary(playerId).elo;
      progression["climber"].current = Math.max(0, currentElo - climberLow.elo);
    }

    // Full House / Humbled progression: how many of the currently ranked
    // players (excluding the player themselves) this player has beaten /
    // lost to. Target is the total number of currently ranked
    // players, minus one when the player is ranked themselves — i.e. the
    // exact set they must complete to earn the achievement. Neither is
    // earnable until at least 5 players are ranked, so while the ranked
    // field is smaller than that the progress is shown as 0.
    const rankedActiveIds = this.parent.leaderboard.getLeaderboard().rankedPlayers.map((p) => p.id);
    const rankedTargetPool = new Set(rankedActiveIds.filter((id) => id !== playerId));
    const enoughRanked = rankedActiveIds.length >= 5;
    const beatenRanked = new Set<string>();
    const lostToRanked = new Set<string>();
    if (enoughRanked) {
      this.parent.games.forEach((game) => {
        if (game.winner === playerId && rankedTargetPool.has(game.loser)) beatenRanked.add(game.loser);
        if (game.loser === playerId && rankedTargetPool.has(game.winner)) lostToRanked.add(game.winner);
      });
    }
    const rankedTarget = rankedTargetPool.size;
    // Players still standing between you and the achievement. While the ranked
    // field is too small (progress forced to 0) the beaten / lost-to sets are
    // empty, so the whole target pool shows as missing.
    const fullHouseMissing = new Set([...rankedTargetPool].filter((id) => !beatenRanked.has(id)));
    const humbledMissing = new Set([...rankedTargetPool].filter((id) => !lostToRanked.has(id)));
    progression["full-house"].current = beatenRanked.size;
    progression["full-house"].target = rankedTarget;
    progression["full-house"].missing = fullHouseMissing;
    progression["humbled"].current = lostToRanked.size;
    progression["humbled"].target = rankedTarget;
    progression["humbled"].missing = humbledMissing;

    // Count earned achievements
    const achievements = this.getAchievements(playerId);
    achievements.forEach((achievement) => {
      const type = achievement.type;
      // Some achievement types (e.g. the record-breaking Earliest / Latest
      // Game) have no progression entry — the `in` guard skips those.
      if (type in progression) {
        progression[type as keyof AchievementProgression].earned++;
      }
    });

    return progression;
  }
}

// Type Definitions
type StreakRecordAchievementData = {
  streakLength: number;
  startedAt: number;
  // Undefined when this streak is the first to establish the league record.
  previousRecord?: number;
};

type AchievementDefinitions = {
  "first-game": { gameId: string; opponent: string };
  "ranked": { gameId: string; opponent: string };
  "donut-1": { gameId: string; opponent: string };
  "donut-5": undefined;
  "streak-all-10": { startedAt: number };
  "streak-player-10": { opponent: string; startedAt: number };
  "streak-player-20": { opponent: string; startedAt: number };
  "back-after-6-months": { lastGameAt: number };
  "back-after-1-year": { lastGameAt: number };
  "back-after-2-years": { lastGameAt: number };
  "retired": undefined;
  "back-from-the-dead": { retiredAt: number };
  // `day` / `weekStart` / `monthStart` is the local midnight starting the
  // record period (weeks start on Monday, months on the 1st). Undefined
  // previousRecord means the period established the very first league record.
  "hero-of-the-day": { day: number; gamesPlayed: number; previousRecord?: number };
  "hero-of-the-week": { weekStart: number; gamesPlayed: number; previousRecord?: number };
  "hero-of-the-month": { monthStart: number; gamesPlayed: number; previousRecord?: number };
  "active-6-months": { firstGameInPeriod: number };
  "active-1-year": { firstGameInPeriod: number };
  "active-2-years": { firstGameInPeriod: number };
  "anniversary": { firstGameAt: number; year: number };
  "tournament-participated": { tournamentId: string };
  "tournament-winner": { tournamentId: string };
  "season-winner": { seasonStart: number };
  "nice-game": { gameId: string; opponent: string };
  "less-is-more": { gameId: string; opponent: string; playerPoints: number; opponentPoints: number };
  "close-calls": undefined;
  "edge-lord": undefined;
  "consistency-is-key": undefined;
  "variety-player": undefined;
  "global-player": undefined;
  "best-friends": { opponent: string; firstGame: number };
  "welcome-committee": { opponents: string[] };
  "community-builder": { opponents: string[] };
  "punching-bag": { startedAt: number };
  "never-give-up": { startedAt: number };
  "comeback-kid": { opponent: string };
  "unbreakable-spirit": { opponent: string };
  "hat-trick": { firstWinAt: number; thirdWinAt: number };
  "perfect-day": { day: number; wins: number };
  // `startDay` is the local midnight of the first day in the 5-consecutive-day
  // run of won days; `weekStart` the Monday of the week containing the run.
  "perfect-week": { weekStart: number; startDay: number };
  "kingslayer": { opponent: string; gameId: string };
  "king-maker": { newKing: string; netScoreGained: number };
  "touched-the-throne": { elo: number; firstGameAt: number; dethroned?: string };
  "on-the-podium": { elo: number; firstGameAt: number };
  "photo-finish": {
    opponent: string;
    gameId: string;
    eloDiff: number;
    playerElo: number;
    opponentElo: number;
  };
  "leap-frog": {
    opponent: string;
    gameId: string;
    ranksJumped: number;
    fromRank: number;
    toRank: number;
    fromElo: number;
    toElo: number;
    leapfroggedPlayers: string[];
    // Undefined when this jump is the first to establish the league record.
    previousRecord?: number;
  };
  // Record-breaking upset achievements — one game always sets both records
  // (Elo is zero-sum). Undefined previousRecord means the game established
  // the very first league record.
  "david": { opponent: string; gameId: string; eloGain: number; previousRecord?: number };
  "goliath": { opponent: string; gameId: string; eloLoss: number; previousRecord?: number };
  "climber": { fromElo: number; toElo: number; fromDate: number; toDate: number };
  "marathon-set": {
    gameId: string;
    opponent: string;
    setWinnerScore: number;
    setLoserScore: number;
    // Undefined when this set is the first to establish the league record.
    previousRecord?: number;
  };
  "streak-ender": { opponent: string; gameId: string; streakLength: number };
  // Record-breaking streak achievements. `streakLength` is how long the
  // streak was when it last held the league record — it grows while the
  // streak keeps extending the record — and `startedAt` is the first game
  // of the streak, so startedAt → earnedAt spans the record run.
  "longest-win-streak": StreakRecordAchievementData;
  "longest-lose-streak": StreakRecordAchievementData;
  "group-stage-star": { tournamentId: string; wins: number };
  "full-house": { count: number; firstGameAt: number };
  "humbled": { count: number; firstGameAt: number };
  // Record-breaking time-of-day achievements. Awarded to both players of
  // the game that sets a new league-wide earliest / latest time-of-day
  // record. `time` is the "HH:MM" the game was played and `minutesIntoDay`
  // the minutes past local midnight — both in the browser's timezone.
  "earliest-game": { gameId: string; opponent: string; time: string; minutesIntoDay: number };
  "latest-game": { gameId: string; opponent: string; time: string; minutesIntoDay: number };
  // Record-breaking most-points-in-one-game achievement, awarded to both
  // players. `points` is the combined score of the game's `setsCounted`
  // highest-scoring sets (at most SHOOTOUT_SETS_COUNTED); `sets` holds those
  // counted sets' scores in game order, from the badge owner's perspective.
  // Undefined previousRecord means the game established the very first
  // league record.
  "shootout": {
    gameId: string;
    opponent: string;
    points: number;
    setsCounted: number;
    sets: { playerPoints: number; opponentPoints: number }[];
    previousRecord?: number;
  };
  // Awarded to both players of a season's very first game.
  "season-opener": { seasonStart: number; gameId: string; opponent: string };
  // Awarded to both players of every 500th league game. `milestone` is that
  // game number.
  "milestone-game": { gameId: string; opponent: string; milestone: number };
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

// The award for holding a streak record — either direction. The two share a
// data shape, so the code that grows one as the streak grows can treat them
// interchangeably.
type StreakRecordAchievement =
  | GenericAchievement<"longest-win-streak">
  | GenericAchievement<"longest-lose-streak">;

// The award for holding a games-in-a-period record — grown through the
// day / week / month while the player still holds the record with it. The
// three share `gamesPlayed`, so the code that grows one as the period
// continues can treat them interchangeably.
type HeroRecordAchievement =
  | GenericAchievement<"hero-of-the-day">
  | GenericAchievement<"hero-of-the-week">
  | GenericAchievement<"hero-of-the-month">;

// Per-player, per-period chase state for a Hero record: the period being
// played (its start timestamp), the games in it so far, and the open award
// still growing with it (if the player holds the record with this period).
type HeroPeriodState = {
  periodStart: number;
  gamesInPeriod: number;
  openRecord: HeroRecordAchievement | undefined;
};

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

type AnniversaryProgression = ProgressionWithTarget & {
  firstGameAt?: number; // The player's first ever game — the recurring anniversary date
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

type MissingPlayersProgression = ProgressionWithTarget & {
  // Currently ranked players the player has not yet beaten (Full House) /
  // not yet lost to (Humbled) — i.e. what's left to complete the set.
  missing?: Set<string>;
};

type LeapFrogProgression = BaseProgression & {
  // Player's own biggest single-game leaderboard jump (0 if none).
  current: number;
  // One rank beyond the league record — the jump that earns the next Leap
  // Frog award. Undefined when no one has set a record yet (a ≥ 2-rank
  // jump wins it outright).
  target?: number;
  // Player who currently holds the league record, if any.
  recordHolder?: string;
};

// David / Goliath chase the league record for the biggest single-game Elo
// swing. The record is fractional, so unlike the integer records the target
// is the record itself and must be strictly exceeded.
type UpsetRecordProgression = BaseProgression & {
  // Player's own biggest qualifying single-game gain / loss (0 if none).
  current: number;
  // The league record to strictly exceed. Undefined when no one has set a
  // record yet (a swing of UPSET_RECORD_FLOOR takes it outright).
  target?: number;
  // Player who currently holds the league record, if any.
  recordHolder?: string;
};

type ShootoutProgression = BaseProgression & {
  // Player's own highest Shootout score: combined points of one game's
  // highest-scoring sets (at most SHOOTOUT_SETS_COUNTED of them). 0 if none.
  current: number;
  // One point beyond the league record — the score that takes it. Undefined
  // when no one has set a record yet (a SHOOTOUT_RECORD_FLOOR-point game
  // takes it outright).
  target?: number;
  // Both players of the record game hold the record together.
  recordHolders?: string[];
};

type MarathonSetProgression = BaseProgression & {
  // Player's own highest winning set score from a true-deuce set
  // they won (winner ≥ 12, loser ≥ 10). 0 if they have none.
  current: number;
  // One point beyond the league-wide record — the winning score that
  // earns the next Marathon Set award. Undefined when no one has set a
  // record yet (next qualifying deuce set wins it outright).
  target?: number;
  // Player who currently holds the league record, if any.
  recordHolder?: string;
};

type HeroRecordProgression = BaseProgression & {
  // Games the player has played so far in the current period (today / this
  // week / this month) — only the current period's total can still grow into
  // the record, so this is what the progress bar measures.
  current: number;
  // One beyond the league record — the single-period games count that takes
  // it. Undefined while nobody holds it (a floor-reaching period takes it
  // outright).
  target?: number;
  // Player who currently holds the league record, if any.
  recordHolder?: string;
  // The player's own busiest period ever, which may be busier than the
  // current one. Shown so they can see how their best compares.
  personalBest: number;
};

type StreakRecordProgression = BaseProgression & {
  // The player's streak as it stands right now (0 if their last game went
  // the other way). Only a live streak can grow into the record, so this is
  // what the progress bar measures.
  current: number;
  // One beyond the league record — the streak that takes it. Undefined
  // while nobody holds it (a streak of STREAK_RECORD_FLOOR takes it
  // outright).
  target?: number;
  // Player who currently holds the league record, if any.
  recordHolder?: string;
  // The player's own longest streak ever, which may be longer than the one
  // they are on now. Shown so they can see how their best compares.
  personalBest: number;
};

// Earliest / Latest Game are record-breaking achievements with no numeric
// progress bar — you either hold the record or you don't. Instead of a
// percentage, the progress view shows the current league record and the
// player's own best so they can gauge how far off they are. Both values are
// minutes past local midnight (browser timezone); undefined when unknown.
type TimeOfDayRecordProgression = BaseProgression & {
  // The current league-wide record time-of-day — the mark to beat.
  recordMinutes?: number;
  // The player's own best (earliest / latest) time-of-day.
  playerMinutes?: number;
};

export type AchievementProgression = {
  "first-game": ProgressionWithTarget;
  "ranked": ProgressionWithTarget;
  "donut-1": ProgressionWithTarget;
  "donut-5": ProgressionWithTarget;
  "streak-all-10": ProgressionWithTarget;
  "streak-player-10": StreakPlayerProgression;
  "streak-player-20": StreakPlayerProgression;
  "back-after-6-months": BackAfterProgression;
  "back-after-1-year": BackAfterProgression;
  "back-after-2-years": BackAfterProgression;
  "retired": BaseProgression;
  "back-from-the-dead": ProgressionWithTarget;
  "active-6-months": ProgressionWithTarget;
  "active-1-year": ProgressionWithTarget;
  "active-2-years": ProgressionWithTarget;
  "anniversary": AnniversaryProgression;
  "tournament-participated": BaseProgression;
  "tournament-winner": BaseProgression;
  "season-winner": ProgressionWithTarget;
  "season-opener": BaseProgression;
  "milestone-game": ProgressionWithTarget;
  "nice-game": BaseProgression;
  "less-is-more": BaseProgression;
  "close-calls": ProgressionWithTarget;
  "edge-lord": ProgressionWithTarget;
  "consistency-is-key": ProgressionWithTarget;
  "variety-player": VarietyPlayerProgression;
  "global-player": VarietyPlayerProgression;
  "best-friends": BestFriendsProgression;
  "welcome-committee": WelcomeCommitteeProgression;
  "community-builder": WelcomeCommitteeProgression;
  "punching-bag": ProgressionWithTarget;
  "never-give-up": ProgressionWithTarget;
  "comeback-kid": BaseProgression;
  "unbreakable-spirit": BaseProgression;
  "hat-trick": ProgressionWithTarget;
  "perfect-day": ProgressionWithTarget;
  "perfect-week": ProgressionWithTarget;
  "kingslayer": BaseProgression;
  "king-maker": BaseProgression;
  "touched-the-throne": BaseProgression;
  "on-the-podium": BaseProgression;
  "photo-finish": BaseProgression;
  "leap-frog": LeapFrogProgression;
  "david": UpsetRecordProgression;
  "goliath": UpsetRecordProgression;
  "climber": ProgressionWithTarget;
  "marathon-set": MarathonSetProgression;
  "shootout": ShootoutProgression;
  "streak-ender": BaseProgression;
  "longest-win-streak": StreakRecordProgression;
  "longest-lose-streak": StreakRecordProgression;
  "hero-of-the-day": HeroRecordProgression;
  "hero-of-the-week": HeroRecordProgression;
  "hero-of-the-month": HeroRecordProgression;
  "group-stage-star": BaseProgression;
  "full-house": MissingPlayersProgression;
  "humbled": MissingPlayersProgression;
  "earliest-game": TimeOfDayRecordProgression;
  "latest-game": TimeOfDayRecordProgression;
};
