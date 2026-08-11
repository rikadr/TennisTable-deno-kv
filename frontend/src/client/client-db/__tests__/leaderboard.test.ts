import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

// Tests run against the guest client config (REACT_APP_CLIENT unset),
// where gameLimitForRanked = 5.

function playerEvent(stream: string, name: string, time: number): EventType {
  return { time, stream, type: EventTypeEnum.PLAYER_CREATED, data: { name } };
}

let gameTime = 10_000;
function gameEvent(winner: string, loser: string): EventType {
  gameTime += 1;
  return {
    time: gameTime,
    stream: `game-${gameTime}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: gameTime, winner, loser },
  };
}

beforeEach(() => {
  gameTime = 10_000;
});

function baseEvents(): EventType[] {
  return [
    playerEvent("player-1", "Alice", 1000),
    playerEvent("player-2", "Bob", 1100),
    playerEvent("player-3", "Carol", 1200),
    // Alice vs Bob: Alice wins 4 in a row, then Bob wins the fifth
    gameEvent("player-1", "player-2"),
    gameEvent("player-1", "player-2"),
    gameEvent("player-1", "player-2"),
    gameEvent("player-1", "player-2"),
    gameEvent("player-2", "player-1"),
    // Alice beats Carol twice
    gameEvent("player-1", "player-3"),
    gameEvent("player-1", "player-3"),
  ];
  // Totals: Alice 7 games, Bob 5 games (exactly the limit), Carol 2 games
}

describe("Leaderboard ranked vs unranked", () => {
  it("uses the guest client game limit of 5", () => {
    const tt = new TennisTable({ events: [] });
    expect(tt.client.gameLimitForRanked).toBe(5);
  });

  it("ranks players with at least gameLimitForRanked games and leaves the rest unranked", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const board = tt.leaderboard.getLeaderboard();

    expect(board.rankedPlayers.map((p) => p.id).sort()).toEqual(["player-1", "player-2"]);
    expect(board.unrankedPlayers.map((p) => p.id)).toEqual(["player-3"]);
  });

  it("treats exactly gameLimitForRanked games as ranked (boundary)", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const board = tt.leaderboard.getLeaderboard();
    const bob = board.rankedPlayers.find((p) => p.id === "player-2");

    expect(bob).toBeDefined();
    expect(bob!.games).toHaveLength(5);
  });

  it("excludes players with no games entirely", () => {
    const events = [...baseEvents(), playerEvent("player-4", "Dave", 1300)];
    const tt = new TennisTable({ events });
    const board = tt.leaderboard.getLeaderboard();

    expect(board.rankedPlayers.find((p) => p.id === "player-4")).toBeUndefined();
    expect(board.unrankedPlayers.find((p) => p.id === "player-4")).toBeUndefined();
  });
});

describe("Leaderboard ordering", () => {
  it("orders ranked players by elo descending and assigns sequential ranks", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const board = tt.leaderboard.getLeaderboard();

    expect(board.rankedPlayers[0].id).toBe("player-1"); // Alice won most games
    expect(board.rankedPlayers[1].id).toBe("player-2");
    expect(board.rankedPlayers[0].elo).toBeGreaterThan(board.rankedPlayers[1].elo);
    expect(board.rankedPlayers.map((p) => p.rank)).toEqual([1, 2]);
  });

  it("orders unranked players by elo descending too", () => {
    const events = [
      ...baseEvents(),
      playerEvent("player-4", "Dave", 1300),
      // Dave beats Carol once: Dave (>1000) must sort above Carol (<1000)
      gameEvent("player-4", "player-3"),
    ];
    const tt = new TennisTable({ events });
    const board = tt.leaderboard.getLeaderboard();

    expect(board.unrankedPlayers.map((p) => p.id)).toEqual(["player-4", "player-3"]);
  });

  it("conserves the total elo across all players with games", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const total = ["player-1", "player-2", "player-3"]
      .map((id) => tt.leaderboard.getPlayerSummary(id).elo)
      .reduce((sum, elo) => sum + elo, 0);

    expect(total).toBeCloseTo(3000, 8);
  });

  it("hides deactivated players from both lists", () => {
    const events: EventType[] = [
      ...baseEvents(),
      { time: 50_000, stream: "player-2", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
    ];
    const tt = new TennisTable({ events });
    const board = tt.leaderboard.getLeaderboard();

    expect(board.rankedPlayers.find((p) => p.id === "player-2")).toBeUndefined();
    expect(board.unrankedPlayers.find((p) => p.id === "player-2")).toBeUndefined();
    // Alice keeps rank 1 and her elo history against Bob still counts
    expect(board.rankedPlayers[0].id).toBe("player-1");
    expect(board.rankedPlayers[0].rank).toBe(1);
  });
});

describe("Leaderboard.getPlayerSummary", () => {
  it("summarises a ranked player with wins, losses, rank and streaks", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const alice = tt.leaderboard.getPlayerSummary("player-1");

    expect(alice.name).toBe("Alice");
    expect(alice.wins).toBe(6);
    expect(alice.loss).toBe(1);
    expect(alice.games).toHaveLength(7);
    expect(alice.elo).toBeGreaterThan(1000);
    expect(alice.isRanked).toBe(true);
    expect(alice.rank).toBe(1);
    // Sequence: W W W W L W W
    expect(alice.streaks).toEqual({ longestWin: 4, longestLose: 1 });
  });

  it("summarises an unranked player without a rank", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const carol = tt.leaderboard.getPlayerSummary("player-3");

    expect(carol.isRanked).toBe(false);
    expect(carol.rank).toBeUndefined();
    expect(carol.wins).toBe(0);
    expect(carol.loss).toBe(2);
    expect(carol.elo).toBeLessThan(1000);
  });

  it("computes the games distribution per opponent", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const alice = tt.leaderboard.getPlayerSummary("player-1");

    expect(alice.gamesDistribution).toEqual([
      { oponentId: "player-2", games: 5 },
      { oponentId: "player-3", games: 2 },
    ]);
  });

  it("computes a zero-sum points distribution between two players", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const alice = tt.leaderboard.getPlayerSummary("player-1");
    const bob = tt.leaderboard.getPlayerSummary("player-2");

    const alicePointsVsBob = alice.pointsDistrubution.find((p) => p.oponentId === "player-2")!.points;
    const bobPointsVsAlice = bob.pointsDistrubution.find((p) => p.oponentId === "player-1")!.points;
    expect(alicePointsVsBob).toBeCloseTo(-bobPointsVsAlice, 8);
    expect(alicePointsVsBob).toBeGreaterThan(0);
  });

  it("returns a default summary for a player with no games", () => {
    const events = [...baseEvents(), playerEvent("player-4", "Dave", 1300)];
    const tt = new TennisTable({ events });
    const dave = tt.leaderboard.getPlayerSummary("player-4");

    expect(dave.elo).toBe(1000);
    expect(dave.wins).toBe(0);
    expect(dave.loss).toBe(0);
    expect(dave.games).toEqual([]);
    expect(dave.isRanked).toBe(false);
    expect(dave.name).toBe("Dave");
  });

  it("returns a default summary with an error name for an unknown id", () => {
    const tt = new TennisTable({ events: baseEvents() });
    const unknown = tt.leaderboard.getPlayerSummary("nope");

    expect(unknown.elo).toBe(1000);
    expect(unknown.games).toEqual([]);
    expect(unknown.isRanked).toBe(false);
    expect(unknown.name).toContain("⛔️");
  });

  it("ranks by counting only active ranked players with higher elo", () => {
    const events: EventType[] = [
      ...baseEvents(),
      // Deactivate Alice: Bob becomes the highest ranked active player
      { time: 50_000, stream: "player-1", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
    ];
    const tt = new TennisTable({ events });
    const bob = tt.leaderboard.getPlayerSummary("player-2");

    expect(bob.isRanked).toBe(true);
    expect(bob.rank).toBe(1);
  });
});
