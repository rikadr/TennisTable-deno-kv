import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

describe("Leaderboard with Deactivated Players", () => {
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
      // Game 1: Alice beats Bob
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
      // Deactivate Bob
      {
        time: 5000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    tennisTable = new TennisTable({ events });
  });

  it("should return summary for deactivated player", () => {
    const summary = tennisTable.leaderboard.getPlayerSummary("player-2");
    expect(summary).toBeDefined();
    expect(summary.name).toBe("Bob");
    expect(summary.games.length).toBe(1);
  });

  it("should not include deactivated player in main leaderboard", () => {
    const leaderboard = tennisTable.leaderboard.getLeaderboard();
    
    const inRanked = leaderboard.rankedPlayers.find(p => p.id === "player-2");
    const inUnranked = leaderboard.unrankedPlayers.find(p => p.id === "player-2");
    
    expect(inRanked).toBeUndefined();
    expect(inUnranked).toBeUndefined();
  });

  it("should include deactivated player in comparison", () => {
    const comparison = tennisTable.leaderboard.comparePlayers(["player-1", "player-2"]);
    expect(comparison.graphData.length).toBeGreaterThan(1); // Initial + 1 game
    const lastPoint = comparison.graphData[comparison.graphData.length - 1];
    expect(lastPoint["player-2"]).toBeDefined();
  });
});
