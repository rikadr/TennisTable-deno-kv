import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Against All Odds: win a game with a win chance of 10% or less, from the
// prediction before the game at 50% or more confidence. 1 time for each game.
//
// Biggest Upset: the league record for the lowest win chance of a win. A win at
// the record or below earns it. A win at 10% or less sets the first record.

describe("Against All Odds and Biggest Upset Achievements", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time,
    data: { winner, loser, playedAt: time },
  });

  // Alice wins 19 of each 20 games. Bob wins the 20th, 40th and 60th games, but
  // the prediction is below 50% confidence until after the 60th game.
  const history = (): EventType[] =>
    Array.from({ length: 60 }, (_, i) =>
      i % 20 === 19 ? game(`g${i + 1}`, 100 + i, "bob", "alice") : game(`g${i + 1}`, 100 + i, "alice", "bob"),
    );

  const awards = (tt: TennisTable, type: string) =>
    [...tt.achievements.achievementMap.values()].flat().filter((a) => a.type === type);

  it("awards the winner of a game with a win chance of 10% or less", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history(), game("upset", 1000, "bob", "alice")] });
    tt.achievements.calculateAchievements();

    const against = awards(tt, "against-all-odds");
    expect(against).toHaveLength(1);
    expect(against[0].earnedBy).toBe("bob");
    expect(against[0].earnedByGame).toBe("upset");
    expect(against[0].data).toEqual({ gameId: "upset", opponent: "alice", winChance: 6, confidence: 55.1 });
  });

  it("does not count a prediction below 50% confidence", () => {
    // The same low win chance at the 60th game, before the confidence reaches 50%.
    const tt = new TennisTable({ events: [...baseEvents, ...history()] });
    tt.achievements.calculateAchievements();

    expect(awards(tt, "against-all-odds")).toHaveLength(0);
    expect(awards(tt, "biggest-upset")).toHaveLength(0);
  });

  it("sets the first Biggest Upset record at 10% or less", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history(), game("upset", 1000, "bob", "alice")] });
    tt.achievements.calculateAchievements();

    const upsets = awards(tt, "biggest-upset");
    expect(upsets).toHaveLength(1);
    expect(upsets[0].earnedBy).toBe("bob");
    expect(upsets[0].data).toEqual({ gameId: "upset", opponent: "alice", winChance: 6, previousRecord: undefined });
    expect(tt.achievements.biggestUpsetRecord).toEqual({ winChance: 6, holder: "bob" });
  });

  it("awards Biggest Upset only for a win at the record or below", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...history(),
        game("upset", 1000, "bob", "alice"),
        // After the upset, Bob has a higher win chance than the record.
        game("second", 1001, "bob", "alice"),
      ],
    });
    tt.achievements.calculateAchievements();

    // The second win is above the record, so it is not a Biggest Upset.
    expect(awards(tt, "biggest-upset").map((a) => a.earnedByGame)).toEqual(["upset"]);
    expect(tt.achievements.biggestUpsetRecord).toEqual({ winChance: 6, holder: "bob" });
  });

  it("shows the lowest win chance in a win and the league record as progress", () => {
    const tt = new TennisTable({ events: [...baseEvents, ...history(), game("upset", 1000, "bob", "alice")] });
    tt.achievements.calculateAchievements();

    const bob = tt.achievements.getPlayerProgression("bob");
    expect(bob["against-all-odds"].lowestWinChance).toBe(6);
    expect(bob["biggest-upset"]).toMatchObject({ recordWinChance: 6, recordHolder: "bob", lowestWinChance: 6 });
  });
});
