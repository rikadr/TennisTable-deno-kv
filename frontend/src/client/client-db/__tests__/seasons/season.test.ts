import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { Season } from "../../seasons/season";

// Q1 2024 season: starts Monday January 1 2024 at 08:00, ends Friday March 22 2024 at 17:00.
// Game times are small offsets from mid-season so they always fall within a single season.
const SEASON = new Date(2024, 0, 15, 12, 0, 0, 0).getTime();

describe("Season Class Tests", () => {
  let tennisTable: TennisTable;
  let baseEvents: EventType[];

  beforeEach(() => {
    // Create base events with players
    baseEvents = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 2000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Bob" },
      },
      {
        time: 3000,
        stream: "player-3",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Charlie" },
      },
    ];
  });

  describe("Season Initialization", () => {
    it("should create a season with start and end times", () => {
      const season = new Season({ start: 1000, end: 5000 });
      expect(season.start).toBe(1000);
      expect(season.end).toBe(5000);
      expect(season.games).toEqual([]);
    });

    it("should initialize with empty games array", () => {
      const season = new Season({ start: 1000, end: 5000 });
      expect(season.games).toHaveLength(0);
    });
  });

  describe("Adding Games", () => {
    it("should add games to the season", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];

      expect(season.games).toHaveLength(1);
      expect(season.games[0].winner).toBe("player-1");
      expect(season.games[0].loser).toBe("player-2");
    });

    it("should only include games within season timeframe", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000, // Within first season
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 10000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: new Date(2024, 4, 15, 12, 0, 0, 0).getTime(), // In a different season (Q2 2024)
            winner: "player-2",
            loser: "player-3",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();

      // Total games across all seasons should equal total games created
      const totalGamesInSeasons = seasons.reduce((sum, s) => sum + s.games.length, 0);
      expect(totalGamesInSeasons).toBe(2);

      // Each season should have at least one game
      seasons.forEach((season) => {
        expect(season.games.length).toBeGreaterThan(0);
      });
    });

    it("should not include grace period games in any season", () => {
      // Q3 2024 ends Friday September 27 at 17:00, Q4 2024 starts Monday October 7 at 08:00.
      // The days in between are the grace period and count towards no season.
      const inQ3 = new Date(2024, 8, 20, 12, 0, 0, 0).getTime(); // September 20
      const inGraceSameMonth = new Date(2024, 8, 28, 12, 0, 0, 0).getTime(); // September 28
      const inGraceNextMonth = new Date(2024, 9, 2, 12, 0, 0, 0).getTime(); // October 2, before Q4 starts
      const inQ4 = new Date(2024, 9, 10, 12, 0, 0, 0).getTime(); // October 10

      const events: EventType[] = [
        ...baseEvents,
        ...[inQ3, inGraceSameMonth, inGraceNextMonth, inQ4].map((playedAt, index) => ({
          time: playedAt,
          stream: `game-${index + 1}`,
          type: EventTypeEnum.GAME_CREATED as const,
          data: {
            playedAt,
            winner: "player-1",
            loser: "player-2",
          },
        })),
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();

      expect(seasons).toHaveLength(2);
      expect(seasons[0].games).toHaveLength(1);
      expect(seasons[0].games[0].playedAt).toBe(inQ3);
      expect(seasons[1].games).toHaveLength(1);
      expect(seasons[1].games[0].playedAt).toBe(inQ4);

      // Every included game must be within its season's start and end
      seasons.forEach((season) => {
        season.games.forEach((game) => {
          expect(game.playedAt).toBeGreaterThanOrEqual(season.start);
          expect(game.playedAt).toBeLessThan(season.end);
        });
      });
    });
  });

  describe("Leaderboard Calculation", () => {
    it("should calculate leaderboard with single game", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      expect(leaderboard).toHaveLength(2);
      expect(leaderboard[0].playerId).toBe("player-1"); // Winner should be first
      expect(leaderboard[0].seasonScore).toBeGreaterThan(0);
    });

    it("should rank players by season score", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-1",
            loser: "player-3",
          },
        },
        {
          time: 6000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 6000,
            winner: "player-2",
            loser: "player-3",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      // Player 1 should be first (2 wins)
      expect(leaderboard[0].playerId).toBe("player-1");
      expect(leaderboard[0].seasonScore).toBeGreaterThan(leaderboard[1].seasonScore);
    });

    it("should track matchups correctly", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const player1 = leaderboard.find((p) => p.playerId === "player-1")!;
      expect(player1.matchups.size).toBe(1);
      expect(player1.matchups.has("player-2")).toBe(true);
    });

    it("should count total games per player", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-2",
            loser: "player-1",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const player1 = leaderboard.find((p) => p.playerId === "player-1")!;
      expect(player1.totalGames).toBe(2);
    });

    it("should apply tiebreaker rules correctly", () => {
      // Create scenario where players have same score but different matchup counts
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "player-4",
          type: EventTypeEnum.PLAYER_CREATED,
          data: { name: "David" },
        },
        // Player 1: 1 matchup, 1 game
        {
          time: 5000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        // Player 3: 2 matchups, 2 games (same total score but more matchups)
        {
          time: 6000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 6000,
            winner: "player-3",
            loser: "player-2",
          },
        },
        {
          time: 7000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 7000,
            winner: "player-3",
            loser: "player-4",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      // Player with fewer matchups should rank higher if scores are similar
      const player1 = leaderboard.find((p) => p.playerId === "player-1")!;
      const player3 = leaderboard.find((p) => p.playerId === "player-3")!;

      expect(player1.matchups.size).toBeLessThan(player3.matchups.size);
    });

    it("should tie break using earliest first game played", () => {
      const events: EventType[] = [
        ...baseEvents,
        // Player 1 first game at 4000
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        // Player 3 first game at 3000 (Earlier)
        {
          time: 3000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 3000, // Earlier than player-1
            winner: "player-3",
            loser: "player-4",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      // Both should have same score (win without details -> 25)
      // Same matchups (1)
      // Same total games (1)
      // Tie breaker: First game played. Player 3 (3000) < Player 1 (4000).

      const p1Index = leaderboard.findIndex((p) => p.playerId === "player-1");
      const p3Index = leaderboard.findIndex((p) => p.playerId === "player-3");

      expect(p3Index).toBeLessThan(p1Index);
      expect(leaderboard[0].playerId).toBe("player-3");
    });
  });

  describe("Performance Calculation", () => {
    it("should calculate performance for winner without score details", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const winner = leaderboard.find((p) => p.playerId === "player-1")!;
      // Winner without score details should get 100/4 = 25
      expect(winner.seasonScore).toBeCloseTo(25.0, 1);
    });

    it("should calculate performance with set scores", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 4001,
          stream: "game-1",
          type: EventTypeEnum.GAME_SCORE,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 1 },
            setPoints: [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 9, gameLoser: 11 },
              { gameWinner: 11, gameLoser: 7 },
            ],
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const winner = leaderboard.find((p) => p.playerId === "player-1")!;
      // With scores, performance should be higher than without
      expect(winner.seasonScore).toBeGreaterThan(25 + 25 * 0.66);
    });

    it("should update best performance when player improves", () => {
      const events: EventType[] = [
        ...baseEvents,
        // First game: player-1 wins narrowly
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 4001,
          stream: "game-1",
          type: EventTypeEnum.GAME_SCORE,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 1 },
            setPoints: [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 9, gameLoser: 11 },
              { gameWinner: 11, gameLoser: 9 },
            ],
          },
        },
        // Second game: player-1 dominates
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 5001,
          stream: "game-2",
          type: EventTypeEnum.GAME_SCORE,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 5 },
              { gameWinner: 11, gameLoser: 3 },
            ],
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const player1 = leaderboard.find((p) => p.playerId === "player-1")!;
      // Should only count the best performance against player-2
      expect(player1.matchups.size).toBe(1);
      expect(player1.matchups.get("player-2")?.bestPerformance).toBeGreaterThan(50);
    });
  });

  describe("Timeline Generation", () => {
    it("should generate timeline with improvements", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const { timeline, allPlayerIds } = season.getTimeline();

      expect(timeline.length).toBeGreaterThan(0);
      expect(allPlayerIds).toContain("player-1");
      expect(allPlayerIds).toContain("player-2");
    });

    it("should track score improvements over time", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-1",
            loser: "player-3",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const { timeline } = season.getTimeline();

      // Should have entries for both games
      expect(timeline.length).toBeGreaterThanOrEqual(2);

      // Each entry should have improvements
      timeline.forEach((entry) => {
        expect(entry.improvements.length).toBeGreaterThan(0);
        expect(entry.time).toBeGreaterThan(0);
        expect(entry.scores).toBeDefined();
      });
    });

    it("should include game reference in improvements", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const { timeline } = season.getTimeline();

      const firstEntry = timeline[0];
      expect(firstEntry.improvements[0].game).toBeDefined();
      expect(firstEntry.improvements[0].game.winner).toBe("player-1");
    });

    it("should sort timeline by time", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-2",
            loser: "player-3",
          },
        },
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const { timeline } = season.getTimeline();

      // Timeline should be sorted by time
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].time).toBeGreaterThanOrEqual(timeline[i - 1].time);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle season with no games", () => {
      const season = new Season({ start: 1000, end: 5000 });
      const leaderboard = season.getLeaderboard();
      const { timeline, allPlayerIds } = season.getTimeline();

      expect(leaderboard).toHaveLength(0);
      expect(timeline).toHaveLength(0);
      expect(allPlayerIds).toHaveLength(0);
    });

    it("should handle player playing against same opponent multiple times", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 5000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 5000,
            winner: "player-1",
            loser: "player-2",
          },
        },
        {
          time: 6000,
          stream: "game-3",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 6000,
            winner: "player-2",
            loser: "player-1",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];
      const leaderboard = season.getLeaderboard();

      const player1 = leaderboard.find((p) => p.playerId === "player-1")!;
      expect(player1.matchups.size).toBe(1); // Only one unique opponent
      expect(player1.totalGames).toBe(3); // But 3 total games
    });

    it("should cache leaderboard and reuse it", () => {
      const events: EventType[] = [
        ...baseEvents,
        {
          time: 4000,
          stream: "game-1",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: SEASON + 4000,
            winner: "player-1",
            loser: "player-2",
          },
        },
      ];

      tennisTable = new TennisTable({ events });
      const seasons = tennisTable.seasons.getSeasons();
      const season = seasons[0];

      const leaderboard1 = season.getLeaderboard();
      const leaderboard2 = season.getLeaderboard();

      // Should return the same cached instance
      expect(leaderboard1).toBe(leaderboard2);
    });

    it("should invalidate cache when adding new game", () => {
      const season = new Season({ start: SEASON, end: SEASON + 10000 });
      const leaderboard1 = season.getLeaderboard();

      // Add a game
      season.addGame({
        id: "game-1",
        playedAt: SEASON + 5000,
        winner: "player-1",
        loser: "player-2",
        score: undefined,
      });

      const leaderboard2 = season.getLeaderboard();

      // Should be different instances after adding game
      expect(leaderboard1).not.toBe(leaderboard2);
      expect(leaderboard2.length).toBeGreaterThan(leaderboard1.length);
    });
  });
});
