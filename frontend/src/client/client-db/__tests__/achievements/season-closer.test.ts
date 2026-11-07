import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { determineSeason } from "../../seasons/seasons";

// Builds the table and calculates the achievements.
const table = (data: ConstructorParameters<typeof TennisTable>[0]): TennisTable => {
  const tt = new TennisTable(data);
  tt.achievements.calculateAchievements();
  return tt;
};

// Season Closer is awarded to both players of a season's last game, when the
// season has ended.
describe("Season Closer Achievement", () => {
  const baseEvents: EventType[] = ["alice", "bob", "carol", "dave"].map((id, index) => ({
    type: EventTypeEnum.PLAYER_CREATED,
    stream: id,
    time: index + 1,
    data: { name: id },
  }));

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  const q1Game1 = new Date(2024, 0, 10, 12).getTime();
  const q1Game2 = new Date(2024, 1, 20, 12).getTime();
  const q1Season = determineSeason(q1Game1);
  const events = [...baseEvents, game("g1", q1Game1, "alice", "bob"), game("g2", q1Game2, "carol", "dave")];

  const awards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "season-closer");

  it("awards both players of the last game at the end of the season", () => {
    const tt = table({ events, referenceTime: q1Season.end + 1 });

    expect(awards(tt, "carol")).toStrictEqual([
      {
        type: "season-closer",
        earnedBy: "carol",
        earnedAt: q1Season.end,
        earnedByGame: "g2",
        data: { seasonStart: q1Season.start, gameId: "g2", opponent: "dave" },
      },
    ]);
    expect(awards(tt, "dave")).toHaveLength(1);
    expect(awards(tt, "alice")).toHaveLength(0);
    expect(awards(tt, "bob")).toHaveLength(0);
  });

  it("awards nothing while the season runs", () => {
    const tt = table({ events, referenceTime: q1Game2 + 1 });
    expect(awards(tt, "carol")).toHaveLength(0);

    // The progress is on the real clock, like all progress figures.
    const progress = tt.achievements.getPlayerProgression("carol")["season-closer"];
    const realSeason = determineSeason(Date.now());
    expect(progress.seasonEnd).toBeGreaterThanOrEqual(realSeason.end);
  });
});
