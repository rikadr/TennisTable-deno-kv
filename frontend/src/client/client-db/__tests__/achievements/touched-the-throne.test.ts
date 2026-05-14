import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("Touched the Throne Achievement", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "carol", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
    ];
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  it("awards the achievement on the first match where a ranked player ends up at rank #1", () => {
    // Bob beats Carol 5 times — both cross the 5-game threshold on the 5th
    // game but neither was ranked entering that game, so no award yet. On
    // the 6th game Bob enters ranked and ends ranked at #1, earning the
    // achievement.
    const games: EventType[] = [];
    for (let i = 0; i < 6; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    const bobThrone = tt.achievements.getAchievements("bob").filter((a) => a.type === "touched-the-throne");
    expect(bobThrone).toHaveLength(1);
    expect(bobThrone[0].earnedAt).toBe(105); // The 6th game (index 5) timestamp.

    // Carol is rank #2 — should not have touched the throne.
    const carolThrone = tt.achievements.getAchievements("carol").filter((a) => a.type === "touched-the-throne");
    expect(carolThrone).toHaveLength(0);
  });

  it("does NOT award on the very match where a player first becomes ranked", () => {
    // 5 games — Bob reaches the threshold on this 5th game, but he was not
    // a ranked player going into it, so the achievement should NOT fire.
    const games: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "touched-the-throne")).toHaveLength(0);
    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "touched-the-throne")).toHaveLength(0);
  });

  it("does NOT award the achievement before a player has enough games to be ranked", () => {
    // Only 4 games — nobody has hit the 5-game threshold yet.
    const games: EventType[] = [];
    for (let i = 0; i < 4; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...games] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "touched-the-throne")).toHaveLength(0);
  });

  it("is only awarded once even if the player drops from #1 and returns", () => {
    // Bob beats Carol 6 times — crosses threshold and then has a 6th ranked
    // match where he is rank #1.
    const ascend: EventType[] = [];
    for (let i = 0; i < 6; i++) {
      ascend.push(game(`asc-${i}`, 100 + i, "bob", "carol"));
    }
    // Carol beats Bob enough times to take #1 from him.
    const carolTakes: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      carolTakes.push(game(`take-${i}`, 200 + i, "carol", "bob"));
    }
    // Bob beats Carol again to reclaim #1.
    const reclaim: EventType[] = [];
    for (let i = 0; i < 5; i++) {
      reclaim.push(game(`rec-${i}`, 300 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events: [...baseEvents, ...ascend, ...carolTakes, ...reclaim] });
    tt.achievements.calculateAchievements();

    const bobThrone = tt.achievements.getAchievements("bob").filter((a) => a.type === "touched-the-throne");
    expect(bobThrone).toHaveLength(1);

    // Carol also touched #1 in the middle, once.
    const carolThrone = tt.achievements.getAchievements("carol").filter((a) => a.type === "touched-the-throne");
    expect(carolThrone).toHaveLength(1);
  });

  it("is awarded even if the player is later deactivated", () => {
    // Bob plays 6 games against Carol, winning all. Then Bob is deactivated.
    // The achievement must remain because Bob was active and ranked at the
    // time he reached rank #1.
    const games: EventType[] = [];
    for (let i = 0; i < 6; i++) {
      games.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }
    const deactivate: EventType = {
      time: 1000,
      stream: "bob",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    };

    const tt = new TennisTable({ events: [...baseEvents, ...games, deactivate] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "touched-the-throne")).toHaveLength(1);
  });
});
