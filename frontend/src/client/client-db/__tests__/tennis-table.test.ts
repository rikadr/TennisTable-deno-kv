import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

describe("TennisTable Basic sanity tests", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    // Setup common test data
    events = [
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
        stream: "game-1",
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: 3000,
          winner: "player-1",
          loser: "player-2",
        },
      },
    ];

    tennisTable = new TennisTable({ events });
  });

  describe("Initialization", () => {
    it("should create a TennisTable instance", () => {
      expect(tennisTable).toBeInstanceOf(TennisTable);
    });

    it("should initialize with provided events", () => {
      expect(tennisTable.events).toEqual(events);
    });

    it("should initialize all sub-modules", () => {
      expect(tennisTable.eventStore).toBeDefined();
      expect(tennisTable.leaderboard).toBeDefined();
      expect(tennisTable.pvp).toBeDefined();
      expect(tennisTable.tournaments).toBeDefined();
      expect(tennisTable.simulations).toBeDefined();
      expect(tennisTable.futureElo).toBeDefined();
      expect(tennisTable.individualPoints).toBeDefined();
      expect(tennisTable.achievements).toBeDefined();
    });
  });

  describe("Players", () => {
    it("should return all active players", () => {
      const players = tennisTable.players;
      expect(players).toHaveLength(2);
      expect(players[0].name).toBe("Alice");
      expect(players[1].name).toBe("Bob");
    });

    it("should return player name by id", () => {
      expect(tennisTable.playerName("player-1")).toBe("Alice");
      expect(tennisTable.playerName("player-2")).toBe("Bob");
    });

    it("should return error message for invalid player id", () => {
      expect(tennisTable.playerName("invalid-id")).toContain("⛔️");
    });

    it("should handle null/undefined player ids", () => {
      expect(tennisTable.playerName(null)).toContain("⛔️No id⛔️");
      expect(tennisTable.playerName(undefined)).toContain("⛔️No id⛔️");
    });
  });

  describe("Games", () => {
    it("should return all games", () => {
      const games = tennisTable.games;
      expect(games).toHaveLength(1);
      expect(games[0].winner).toBe("player-1");
      expect(games[0].loser).toBe("player-2");
    });

    it("should sort games by playedAt time", () => {
      const newEvents: EventType[] = [
        ...events,
        {
          time: 4000,
          stream: "game-2",
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: 4000,
            winner: "player-2",
            loser: "player-1",
          },
        },
      ];
      const tt = new TennisTable({ events: newEvents });
      const games = tt.games;

      expect(games).toHaveLength(2);
      expect(games[0].playedAt).toBeLessThan(games[1].playedAt);
    });
  });

  describe("Leaderboard", () => {
    it("should calculate leaderboard correctly", () => {
      const leaderboard = tennisTable.leaderboard.getLeaderboard();
      expect(leaderboard).toBeDefined();
      expect(leaderboard.rankedPlayers).toBeDefined();
      expect(leaderboard.unrankedPlayers).toBeDefined();
    });

    it("should rank players based on ELO", () => {
      const tt = new TennisTable({ events });
      const gameLimitForRanked = tt.client.gameLimitForRanked;

      // Add enough games to reach ranked status based on the actual client config
      const manyGamesEvents: EventType[] = [...events];
      for (let i = 0; i < gameLimitForRanked; i++) {
        manyGamesEvents.push({
          time: 4000 + i,
          stream: `game-${i + 2}`,
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: 4000 + i,
            winner: "player-1",
            loser: "player-2",
          },
        });
      }

      const ttWithGames = new TennisTable({ events: manyGamesEvents });
      const leaderboard = ttWithGames.leaderboard.getLeaderboard();

      expect(leaderboard.rankedPlayers.length).toBeGreaterThan(0);
    });
  });

  describe("PVP", () => {
    it("should compare two players", () => {
      const comparison = tennisTable.pvp.compare("player-1", "player-2");

      expect(comparison.player1.playerId).toBe("player-1");
      expect(comparison.player2.playerId).toBe("player-2");
      expect(comparison.player1.wins).toBe(1);
      expect(comparison.player2.wins).toBe(0);
      expect(comparison.games).toHaveLength(1);
    });

    it("should calculate win streaks correctly", () => {
      const manyWinsEvents: EventType[] = [...events];

      // Add 3 consecutive wins for player-1
      for (let i = 0; i < 3; i++) {
        manyWinsEvents.push({
          time: 4000 + i,
          stream: `game-${i + 2}`,
          type: EventTypeEnum.GAME_CREATED,
          data: {
            playedAt: 4000 + i,
            winner: "player-1",
            loser: "player-2",
          },
        });
      }

      const tt = new TennisTable({ events: manyWinsEvents });
      const comparison = tt.pvp.compare("player-1", "player-2");

      expect(comparison.player1.streak.current).toBe(4);
      expect(comparison.player1.streak.longest).toBe(4);
    });
  });

  describe("ELO Calculation", () => {
    it("should initialize players with starting ELO", () => {
      const leaderboard = tennisTable.leaderboard.getLeaderboard();
      const allPlayers = [...leaderboard.rankedPlayers, ...leaderboard.unrankedPlayers];

      // Players with no games should be near initial ELO (1000)
      allPlayers.forEach((player) => {
        expect(player.elo).toBeGreaterThan(0);
      });
    });

    it("should update ELO after games", () => {
      const playerSummary = tennisTable.leaderboard.getPlayerSummary("player-1");

      expect(playerSummary).toBeDefined();
      if (!playerSummary) {
        throw new Error("Unexpected undefined player summary");
      }
      expect(playerSummary.elo).toBeGreaterThan(1000); // Winner should gain ELO
      expect(playerSummary.wins).toBe(1);
      expect(playerSummary.loss).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty events array", () => {
      const emptyTT = new TennisTable({ events: [] });
      expect(emptyTT.players).toHaveLength(0);
      expect(emptyTT.games).toHaveLength(0);
    });

    it("should handle deactivated players", () => {
      const deactivatedEvents: EventType[] = [
        ...events,
        {
          time: 5000,
          stream: "player-2",
          type: EventTypeEnum.PLAYER_DEACTIVATED,
          data: null,
        },
      ];

      const tt = new TennisTable({ events: deactivatedEvents });
      const activePlayers = tt.players;

      expect(activePlayers).toHaveLength(1);
      expect(activePlayers[0].id).toBe("player-1");
    });

    it("should handle player reactivation", () => {
      const reactivatedEvents: EventType[] = [
        ...events,
        {
          time: 5000,
          stream: "player-2",
          type: EventTypeEnum.PLAYER_DEACTIVATED,
          data: null,
        },
        {
          time: 6000,
          stream: "player-2",
          type: EventTypeEnum.PLAYER_REACTIVATED,
          data: null,
        },
      ];

      const tt = new TennisTable({ events: reactivatedEvents });
      const activePlayers = tt.players;

      expect(activePlayers).toHaveLength(2);
    });
  });

  describe("Game Scores", () => {
    it("should handle games with scores", () => {
      const scoredGameEvents: EventType[] = [
        ...events,
        {
          time: 4000,
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

      const tt = new TennisTable({ events: scoredGameEvents });
      const game = tt.games[0];

      expect(game.score).toBeDefined();
      expect(game.score?.setsWon.gameWinner).toBe(2);
      expect(game.score?.setPoints).toHaveLength(3);
    });
  });
});
