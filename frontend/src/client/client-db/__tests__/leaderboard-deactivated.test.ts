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

  it("should return summary for deactivated player with no games (filtered out)", () => {
    // Games involving deactivated players are filtered out from current leaderboard calculations
    const summary = tennisTable.leaderboard.getPlayerSummary("player-2");
    expect(summary).toBeDefined();
    expect(summary.name).toBe("Bob");
    expect(summary.games.length).toBe(0); // Bob's games are filtered because he's inactive at calculation time
  });

  it("should not include deactivated player in main leaderboard", () => {
    const leaderboard = tennisTable.leaderboard.getLeaderboard();
    
    const inRanked = leaderboard.rankedPlayers.find(p => p.id === "player-2");
    const inUnranked = leaderboard.unrankedPlayers.find(p => p.id === "player-2");
    
    expect(inRanked).toBeUndefined();
    expect(inUnranked).toBeUndefined();
  });

  it("should only show initial ELO for comparison with deactivated player (games filtered)", () => {
    // Games involving deactivated players are filtered out from calculations
    const comparison = tennisTable.leaderboard.comparePlayers(["player-1", "player-2"]);
    expect(comparison.graphData.length).toBe(1); // Only initial state, no games included
    const initialPoint = comparison.graphData[0];
    expect(initialPoint["player-1"]).toBe(1000); // Initial ELO
    expect(initialPoint["player-2"]).toBe(1000); // Initial ELO
  });
});
