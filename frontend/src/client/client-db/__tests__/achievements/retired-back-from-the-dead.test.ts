import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Retired and Back From The Dead achievements", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  function calculate(events: EventType[]): TennisTable {
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    return tt;
  }

  it("awards Retired when a player is deactivated", () => {
    const tt = calculate([
      ...baseEvents,
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 100, data: null },
    ]);

    const retired = tt.achievements.getAchievements("alice").filter((a) => a.type === "retired");
    expect(retired).toStrictEqual([{ type: "retired", earnedBy: "alice", earnedAt: 100, data: undefined }]);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "retired")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice")["retired"].earned).toBe(1);
  });

  it("awards Back From The Dead on reactivation, remembering when the retirement happened", () => {
    const tt = calculate([
      ...baseEvents,
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 100, data: null },
      { type: EventTypeEnum.PLAYER_REACTIVATED, stream: "alice", time: 500, data: null },
    ]);

    const comebacks = tt.achievements.getAchievements("alice").filter((a) => a.type === "back-from-the-dead");
    expect(comebacks).toStrictEqual([
      { type: "back-from-the-dead", earnedBy: "alice", earnedAt: 500, data: { retiredAt: 100 } },
    ]);
    expect(tt.achievements.getPlayerProgression("alice")["back-from-the-dead"].earned).toBe(1);
  });

  it("awards both once per retirement cycle", () => {
    const tt = calculate([
      ...baseEvents,
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 100, data: null },
      { type: EventTypeEnum.PLAYER_REACTIVATED, stream: "alice", time: 200, data: null },
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 300, data: null },
      { type: EventTypeEnum.PLAYER_REACTIVATED, stream: "alice", time: 400, data: null },
    ]);

    const achievements = tt.achievements.getAchievements("alice");
    expect(achievements.filter((a) => a.type === "retired")).toHaveLength(2);
    const comebacks = achievements.filter((a) => a.type === "back-from-the-dead");
    expect(comebacks).toHaveLength(2);
    expect(comebacks.map((a) => a.data)).toStrictEqual([{ retiredAt: 100 }, { retiredAt: 300 }]);
  });

  it("does not award Back From The Dead for a reactivation without a recorded retirement", () => {
    const tt = calculate([
      ...baseEvents,
      { type: EventTypeEnum.PLAYER_REACTIVATED, stream: "alice", time: 100, data: null },
    ]);

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "back-from-the-dead")).toHaveLength(0);
  });

  it("awards nothing to players who never retired", () => {
    const tt = calculate([...baseEvents]);

    const progression = tt.achievements.getPlayerProgression("alice");
    expect(progression["retired"].earned).toBe(0);
    expect(progression["back-from-the-dead"].earned).toBe(0);
  });
});
