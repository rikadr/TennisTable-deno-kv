import { ONE_DAY } from "../../../../common/time-in-ms";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { HISTORY_MAX_POINTS, hallOfFameHistoryTimes } from "../../hall-of-fame-history";
import { TennisTable } from "../../tennis-table";

describe("Hall of Fame score history timestamps", () => {
  const created = 1_700_000_000_000;

  it("returns only the creation time when the player was created now", () => {
    expect(hallOfFameHistoryTimes(created, created)).toEqual([created]);
  });

  it("returns the creation time and now for a career shorter than one day", () => {
    const now = created + ONE_DAY / 2;
    expect(hallOfFameHistoryTimes(created, now)).toEqual([created, now]);
  });

  it("starts at the creation time and ends at now", () => {
    const now = created + 500 * ONE_DAY;
    const times = hallOfFameHistoryTimes(created, now);
    expect(times[0]).toBe(created);
    expect(times[times.length - 1]).toBe(now);
  });

  it("never returns more points than the maximum", () => {
    for (const days of [1, 2, 30, 99, 100, 101, 365, 1_000, 10_000]) {
      const times = hallOfFameHistoryTimes(created, created + days * ONE_DAY);
      expect(times.length).toBeLessThanOrEqual(HISTORY_MAX_POINTS);
    }
  });

  it("keeps at least one day between every point", () => {
    for (const days of [1, 2, 30, 99, 100, 101, 365, 1_000, 10_000]) {
      const times = hallOfFameHistoryTimes(created, created + days * ONE_DAY);
      for (let i = 1; i < times.length; i++) {
        expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(ONE_DAY);
      }
    }
  });

  it("uses one point per day for a career shorter than the maximum", () => {
    const times = hallOfFameHistoryTimes(created, created + 10 * ONE_DAY);
    expect(times.length).toBe(11);
  });

  it("uses the full maximum for a long career", () => {
    const times = hallOfFameHistoryTimes(created, created + 5 * 365 * ONE_DAY);
    expect(times.length).toBe(HISTORY_MAX_POINTS);
  });

  it("rises in time", () => {
    const times = hallOfFameHistoryTimes(created, created + 743 * ONE_DAY);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

describe("Hall of Fame score history", () => {
  const created = 1_700_000_000_000;

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // "a" plays one game on day 1 and one game on day 20, so the score grows
  // twice over a 40 day career.
  const events: EventType[] = [
    { time: created, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
    { time: created, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
    game("g1", created + 1 * ONE_DAY, "a", "b"),
    game("g2", created + 20 * ONE_DAY, "a", "b"),
  ];

  const historyFor = (playerId: string) => {
    const tennisTable = new TennisTable({ events });
    return tennisTable.hallOfFameHistory.computeForPlayer(playerId, created + 40 * ONE_DAY);
  };

  it("starts the player at a score of 0 on the day the player joined", () => {
    const { points } = historyFor("a");
    expect(points[0].time).toBe(created);
    expect(points[0].total).toBe(0);
  });

  it("scores the last point the same as the score of the player today", () => {
    const tennisTable = new TennisTable({ events });
    const { points } = tennisTable.hallOfFameHistory.computeForPlayer("a", created + 40 * ONE_DAY);
    const today = tennisTable.hallOfFame.getScoreForAnyPlayer("a");
    expect(points[points.length - 1].total).toBe(today?.score.total);
  });

  it("reports every section of the score at every point", () => {
    const { points } = historyFor("a");
    const last = points[points.length - 1];
    expect(last.factors.experience).toBe(6); // 2 wins, 3 points each
    expect(last.factors.socialDiversity).toBe(20); // 1 unique opponent
  });

  it("grows the score when the player plays, and holds it when the player rests", () => {
    const { points } = historyFor("a");
    const afterFirstGame = points.find((p) => p.time > created + 1 * ONE_DAY);
    const beforeSecondGame = points.findLast((p) => p.time < created + 20 * ONE_DAY);
    expect(afterFirstGame?.factors.experience).toBe(3);
    expect(beforeSecondGame?.factors.experience).toBe(3);
  });

  it("returns no points for a player that does not exist", () => {
    expect(historyFor("unknown").points).toEqual([]);
  });

  it("reports the progress of every point", () => {
    const progress: number[] = [];
    const tennisTable = new TennisTable({ events });
    const { points } = tennisTable.hallOfFameHistory.computeForPlayer("a", created + 40 * ONE_DAY, (p) =>
      progress.push(p),
    );
    expect(progress.length).toBe(points.length);
    expect(progress[progress.length - 1]).toBe(1);
  });
});
