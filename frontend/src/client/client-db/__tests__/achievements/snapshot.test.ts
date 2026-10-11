import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

/**
 * The web worker calculates the achievements and sends a snapshot. A
 * TennisTable made with the snapshot gives the same achievements and
 * progression as one that calculates them.
 */
describe("Achievements snapshot", () => {
  const player = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id.toUpperCase() },
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  const DAY = 24 * 60 * 60 * 1000;
  const START = Date.UTC(2024, 0, 15, 12);
  const events: EventType[] = [
    player("a", 1),
    player("b", 2),
    player("c", 3),
    ...Array.from({ length: 30 }, (_, i) =>
      game(`g${i}`, START + i * DAY, ["a", "b", "c"][i % 3], ["b", "c", "a"][i % 3]),
    ),
  ];

  // The progression of streaks and absences counts up to the real clock
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(START + 400 * DAY));
  afterEach(() => jest.restoreAllMocks());

  it("gives the same achievements and progression as a calculation", () => {
    const calculated = new TennisTable({ events });
    const snapshot = calculated.achievements.toSnapshot();
    const fromSnapshot = new TennisTable({ events, achievements: snapshot });

    expect(fromSnapshot.achievements.isReady).toBe(true);
    expect(fromSnapshot.achievements.achievementMap).toEqual(calculated.achievements.achievementMap);
    expect(fromSnapshot.achievements.getAchievementsEarnedByGame("g0")).toEqual(
      calculated.achievements.getAchievementsEarnedByGame("g0"),
    );
    for (const id of ["a", "b", "c"]) {
      expect(fromSnapshot.achievements.getPlayerProgression(id)).toEqual(
        calculated.achievements.getPlayerProgression(id),
      );
    }
  });

  it("has the progression of every player in the snapshot", () => {
    const snapshot = new TennisTable({ events }).achievements.toSnapshot();

    expect([...snapshot.progression.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("waits for a new snapshot when the snapshot has no progression for a player of the events", () => {
    const snapshot = new TennisTable({ events }).achievements.toSnapshot();
    const withNewPlayer = new TennisTable({
      events: [...events, player("d", START + 40 * DAY)],
      achievements: snapshot,
    });

    expect(withNewPlayer.achievements.isReady).toBe(false);
    expect(withNewPlayer.achievements.achievementMap.size).toBe(0);
  });

  it("has no achievements while the snapshot is pending", () => {
    const pending = new TennisTable({ events, achievements: "pending" });
    pending.achievements.calculateAchievements();

    expect(pending.achievements.isReady).toBe(false);
    expect(pending.achievements.achievementMap.size).toBe(0);
    expect(pending.achievements.getAchievementsEarnedByGame("g0")).toEqual([]);
  });
});
