import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("Touched the Throne Achievement", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // 5-player double round-robin (20 games). All 5 ranked by time 113
  // (A's 8th game), with standings A=1, B=2, C=3, D=4, E=5.
  const fivePlayerSetup = (): EventType[] => {
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
      ["b", "c"], ["b", "d"], ["b", "e"],
      ["c", "d"], ["c", "e"],
      ["d", "e"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    return events;
  };

  it("awards the achievement when a ranked player reaches rank #1 with ≥5 ranked", () => {
    const tt = new TennisTable({ events: fivePlayerSetup() });
    tt.achievements.calculateAchievements();

    const aThrone = tt.achievements.getAchievements("a").filter((x) => x.type === "touched-the-throne");
    expect(aThrone).toHaveLength(1);
    // A first lands at rank #1 with all 5 players ranked on game time 113
    // (A's 8th match — beating E and pushing E across the threshold).
    expect(aThrone[0].earnedAt).toBe(113);

    // No other player ever reaches rank #1.
    for (const id of ["b", "c", "d", "e"]) {
      expect(tt.achievements.getAchievements(id).filter((x) => x.type === "touched-the-throne")).toHaveLength(0);
    }
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
    // 4-player double round-robin (12 games). All 4 ranked, A is rank #1
    // but rankedCount = 4 < 5, so no throne is awarded.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    for (const id of ["a", "b", "c", "d"]) {
      expect(tt.achievements.getAchievements(id).filter((x) => x.type === "touched-the-throne")).toHaveLength(0);
    }
  });

  it("does NOT award before any player has enough games to be ranked", () => {
    // Only 4 games between A and B — neither hits the 5-game threshold.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
    ];
    for (let i = 0; i < 4; i++) {
      events.push(game(`g${i}`, 100 + i, "a", "b"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "touched-the-throne")).toHaveLength(0);
  });

  it("is only awarded once even if a player drops from #1 and reclaims it", () => {
    // After the setup A is rank #1. B then beats A three times — by the
    // third win B's Elo has crossed A's so B becomes rank #1 (and earns
    // throne for the first time). A then beats B once to reclaim. A
    // already had the throne so the reclaim doesn't add a second one.
    const events = [
      ...fivePlayerSetup(),
      game("take-1", 1000, "b", "a"),
      game("take-2", 1001, "b", "a"),
      game("take-3", 1002, "b", "a"),
      game("reclaim", 1100, "a", "b"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "touched-the-throne")).toHaveLength(1);
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "touched-the-throne")).toHaveLength(1);
  });

  it("is awarded even if the player is later deactivated", () => {
    // A reaches rank #1 during the setup and is then deactivated. The
    // achievement was earned while A was active and stays.
    const events: EventType[] = [
      ...fivePlayerSetup(),
      {
        time: 2000,
        stream: "a",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "touched-the-throne")).toHaveLength(1);
  });
});
