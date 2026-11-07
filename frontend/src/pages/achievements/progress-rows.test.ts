import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { TennisTable } from "../../client/client-db/tennis-table";
import { playersProgressForType } from "./progress-rows";

describe("playersProgressForType", () => {
  it("puts an active player before a retired player with the same progress", () => {
    // Alice is created first and is retired. Neither player has a game.
    const events: EventType[] = [
      { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "alice" } },
      { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "bob" } },
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "alice", time: 3, data: null },
    ];
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const rows = playersProgressForType(tt, "first-game");
    expect(rows.map((row) => [row.player.id, row.isRetired])).toEqual([
      ["bob", false],
      ["alice", true],
    ]);
  });
});
