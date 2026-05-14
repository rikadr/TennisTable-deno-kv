import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("On the Podium Achievement", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
      { time: 4, stream: "dave", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Dave" } },
    ];
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  it("awards the achievement when a player first reaches a top-3 rank", () => {
    // Bob beats Carol 5 times — both reach ranked status. With only 2 ranked
    // players, both are trivially in top-3.
    const games: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
  });

  it("is only awarded once per player", () => {
    // Bob beats Carol 5 times, then drops by losing 5 games. He stays in top-3
    // throughout — should still be only one award.
    const games: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      games.push(game(`win-${i}`, 100 + i, "bob", "carol"));
    }
    for (let i = 0; i < 5; i++) {
      games.push(game(`lose-${i}`, 200 + i, "carol", "bob"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
  });

  it("is NOT awarded to an unranked player even if they have the highest Elo", () => {
    // Alice (one win) has the highest Elo but only 1 game — not ranked.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("ignores deactivated players when computing the leaderboard pool", () => {
    // Bob plays Carol 5 times and wins all — Bob would naively land at
    // rank #1 in the all-players pool. But Bob is deactivated *before* any
    // games are played, so he should not be counted as a ranked player at
    // game time. With Bob excluded, Carol slips into top-3 (she becomes the
    // only ranked active player) and earns the achievement; Bob does not.
    const deactivateBob: EventType = {
      time: 50,
      stream: "bob",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    };
    const games: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, deactivateBob, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
  });
});
