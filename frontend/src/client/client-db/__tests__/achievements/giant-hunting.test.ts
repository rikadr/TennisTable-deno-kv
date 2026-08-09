import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Giant Hunting: win 3 games against higher-ranked opponents within one
// local calendar day — counted per game, not per distinct opponent. A win
// counts when the opponent's pre-match rank was better (lower) than the
// player's own, both were ranked, and the ranked cohort had ≥5 players.
// Once per day; a new day is a new chase.
// Default GuestClient has gameLimitForRanked = 5.

describe("Giant Hunting Achievement", () => {
  const createPlayer = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  });

  const gameAt = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    time: playedAt,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  });

  // 5-player double round-robin on Jan 10 2024 (20 games, minutes apart).
  // Every player ends with 8 games (all ranked). Standings: A(rank1) B C D
  // E(rank5), with clear Elo separation.
  const fivePlayerSetup = (): EventType[] => {
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
      ["b", "c"], ["b", "d"], ["b", "e"],
      ["c", "d"], ["c", "e"],
      ["d", "e"],
    ];
    let minute = 0;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(gameAt(`rr-${round}-${winner}-${loser}`, new Date(2024, 0, 10, 9, minute++).getTime(), winner, loser));
      }
    }
    return events;
  };

  it("awards the 3rd win over a higher-ranked opponent in one day", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      // Jan 15: bottom-ranked E beats the top 3 in one day.
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "e", "c"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(new Date(2024, 0, 15, 12).getTime());
    expect(awards[0].data.day).toBe(new Date(2024, 0, 15).getTime());
    expect(awards[0].data.giants).toHaveLength(3);
    expect(awards[0].data.giants.map((g) => g.opponent)).toEqual(["a", "b", "c"]);
    // Every slain giant outranked the hunter going into the match.
    for (const giant of awards[0].data.giants) {
      expect(giant.opponentRank).toBeLessThan(giant.playerRank);
    }
  });

  it("counts wins, not distinct opponents — 3 wins over the same giant award it", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      // Jan 15: bottom-ranked E beats top-ranked A three times. A must still
      // outrank E before each game for every win to count.
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "a"),
      gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "e", "a"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.giants.map((g) => g.opponent)).toEqual(["a", "a", "a"]);
    for (const giant of awards[0].data.giants) {
      expect(giant.opponentRank).toBeLessThan(giant.playerRank);
    }
  });

  it("does NOT award for only 2 giant wins in a day", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting")).toHaveLength(0);
  });

  it("does NOT award when the 3 giant wins are spread over two days", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      gameAt("h3", new Date(2024, 0, 16, 10).getTime(), "e", "c"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting")).toHaveLength(0);
  });

  it("does NOT count wins over lower-ranked opponents", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      // Top-ranked A beats 3 lower-ranked players in one day — no giants here.
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "a", "c"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "a", "d"),
      gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "a", "e"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "giant-hunting")).toHaveLength(0);
  });

  it("awards once per day, even with a 4th giant win", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "e", "c"),
      gameAt("h4", new Date(2024, 0, 15, 13).getTime(), "e", "d"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.giants).toHaveLength(3);
  });

  it("CAN be earned again on a later day", () => {
    const events: EventType[] = [
      ...fivePlayerSetup(),
      gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
      gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "e", "c"),
      // E's Elo has climbed, so rebuild the gap: the whole field beats E
      // again, dropping E firmly back to the bottom rank...
      gameAt("r1", new Date(2024, 0, 16, 10).getTime(), "a", "e"),
      gameAt("r2", new Date(2024, 0, 16, 11).getTime(), "b", "e"),
      gameAt("r3", new Date(2024, 0, 16, 12).getTime(), "c", "e"),
      gameAt("r4", new Date(2024, 0, 16, 13).getTime(), "d", "e"),
      // ...and E hunts the top 3 down once more on Jan 17.
      gameAt("h4", new Date(2024, 0, 17, 10).getTime(), "e", "a"),
      gameAt("h5", new Date(2024, 0, 17, 11).getTime(), "e", "b"),
      gameAt("h6", new Date(2024, 0, 17, 12).getTime(), "e", "c"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "giant-hunting")).toHaveLength(2);
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
    // 4-player double round-robin — everyone ranked, but the cohort is
    // below the ≥5 gate.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ];
    let minute = 0;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(gameAt(`rr-${round}-${winner}-${loser}`, new Date(2024, 0, 10, 9, minute++).getTime(), winner, loser));
      }
    }
    events.push(gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "d", "a"));
    events.push(gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "d", "b"));
    events.push(gameAt("h3", new Date(2024, 0, 15, 12).getTime(), "d", "c"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("d").filter((x) => x.type === "giant-hunting")).toHaveLength(0);
  });

  describe("Progression (live, resets each day)", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("tracks today's giant wins and the best day ever", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 15, 20));

      const events: EventType[] = [
        ...fivePlayerSetup(),
        gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
        gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      ];

      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();

      const progression = tt.achievements.getPlayerProgression("e");
      expect(progression["giant-hunting"].current).toBe(2);
      expect(progression["giant-hunting"].target).toBe(3);
      expect(progression["giant-hunting"].best).toBe(2);
      expect(progression["giant-hunting"].earned).toBe(0);
    });

    it("resets progress to 0 the next day, keeping the best", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2024, 0, 16, 8));

      const events: EventType[] = [
        ...fivePlayerSetup(),
        gameAt("h1", new Date(2024, 0, 15, 10).getTime(), "e", "a"),
        gameAt("h2", new Date(2024, 0, 15, 11).getTime(), "e", "b"),
      ];

      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();

      const progression = tt.achievements.getPlayerProgression("e");
      expect(progression["giant-hunting"].current).toBe(0);
      expect(progression["giant-hunting"].best).toBe(2);
    });
  });
});
