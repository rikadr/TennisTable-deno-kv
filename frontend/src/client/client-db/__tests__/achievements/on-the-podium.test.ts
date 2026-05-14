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

  it("awards the achievement on the first ranked match where a player ends up in top 3", () => {
    // Bob beats Carol 6 times. Both cross the 5-game threshold on game 5,
    // but the achievement should not fire there because neither was a
    // ranked player going into game 5. On game 6 both players are ranked
    // entering the match and both end up in top 3 (it's a 2-player pool),
    // so both earn the badge.
    const games: EventType[] = [];
    for (let i = 0; i < 6; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    const bobPodium = tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium");
    const carolPodium = tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium");
    expect(bobPodium).toHaveLength(1);
    expect(carolPodium).toHaveLength(1);
    expect(bobPodium[0].earnedAt).toBe(105);
    expect(carolPodium[0].earnedAt).toBe(105);
  });

  it("does NOT award on the very match where a player first becomes ranked", () => {
    // Exactly 5 games — Bob and Carol both cross the threshold on this
    // 5th game but neither was ranked entering it. No achievement.
    const games: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award at the very beginning when no player is yet ranked", () => {
    // Only 4 games — nobody has hit the ranked threshold yet.
    const games: EventType[] = [];
    for (let i = 0; i < 4; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("is only awarded once per player", () => {
    // Bob beats Carol 5 times, then Carol wins 5. After Carol's first win
    // (the 6th game overall) both players are ranked entering and end in
    // top 3 — both earn the badge once. Subsequent games don't add more.
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
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
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
    // Bob plays Carol 6 times and wins all — without the active filter Bob
    // would naively land at rank #1 in the all-players pool. But Bob is
    // deactivated *before* any games are played, so he should not be
    // counted as a ranked player at game time. With Bob excluded, Carol is
    // the only ranked-active player. Bob never gets the achievement;
    // Carol earns it once (on the 6th game where she is ranked entering).
    const deactivateBob: EventType = {
      time: 50,
      stream: "bob",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    };
    const games: EventType[] = [];
    for (let i = 0; i < 6; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, deactivateBob, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
  });
});
