import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Season's Champion progression", () => {
  it("reports the best final rank from finished seasons as the best value", () => {
    // A game inside the Q1 2024 season (starts the first Monday of January
    // 2024, ends in late March) — long finished, so its final ranks count.
    const playedAt = new Date(2024, 1, 15, 12).getTime();
    const events: EventType[] = [
      { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
      {
        type: EventTypeEnum.GAME_CREATED,
        stream: "g1",
        time: playedAt,
        data: { winner: "alice", loser: "bob", playedAt },
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("alice")["season-winner"].best).toBe(1);
    expect(tt.achievements.getPlayerProgression("bob")["season-winner"].best).toBe(2);
    // Carol never played in a season — no best rank to report.
    expect(tt.achievements.getPlayerProgression("carol")["season-winner"].best).toBeUndefined();
  });
});
