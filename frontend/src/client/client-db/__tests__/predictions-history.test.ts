import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-13T12:00:00Z");

function buildTennisTable(): TennisTable {
  const events: EventType[] = ["a", "b", "c"].map((id, i) => ({
    time: i,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id.toUpperCase() },
  }));
  [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
    ["a", "b"],
  ].forEach(([winner, loser], i) => {
    const playedAt = NOW - (40 - 10 * i) * DAY;
    events.push({
      time: playedAt,
      stream: `g${i}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    });
  });
  return new TennisTable({ events });
}

describe("PredictionsHistory.computeHistoryForPlayer", () => {
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  it("gives all entries at once, oldest first, from the first game of the player until now", () => {
    const entries = buildTennisTable().predictionsHistory.computeHistoryForPlayer("a");

    expect(entries.length).toBeGreaterThan(1);
    expect(entries[0].time).toBe(NOW - 40 * DAY);
    expect(entries[entries.length - 1].time).toBe(NOW);
    for (let i = 1; i < entries.length; i++) expect(entries[i].time).toBeGreaterThan(entries[i - 1].time);
    // Each game of the player counts in 1 entry
    expect(entries.reduce((sum, entry) => sum + entry.gamesPlayed, 0)).toBe(3);
    expect(entries[entries.length - 1].oponents.b.winChance).toBeGreaterThan(0.5);
  });

  it("gives no entries for a player with no games", () => {
    expect(buildTennisTable().predictionsHistory.computeHistoryForPlayer("x")).toEqual([]);
  });
});
