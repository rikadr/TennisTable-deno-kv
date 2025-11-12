import { EventType, EventTypeEnum } from "../event-store/event-types";
import { TennisTable } from "../tennis-table";

describe("TennisTable", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    // Setup common test data
    events = [];
    tennisTable = new TennisTable({ events });
  });

  describe("Donut", () => {
    beforeEach(() => {
      events = [{ type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1000, data: { name: "Alice" } }];
      tennisTable = new TennisTable({ events });
    });
  });
});
