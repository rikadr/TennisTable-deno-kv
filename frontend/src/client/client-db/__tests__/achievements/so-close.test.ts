import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { determineSeason } from "../../seasons/seasons";

// So Close is awarded when a season ends, to every player other than the
// winner whose final season score is within SO_CLOSE_MAX_DEFICIT_FRACTION
// (10%) of the winner's score — whatever rank the tiebreakers left them at.
describe("So Close Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "erin", time: 5, data: { name: "Erin" } },
  ];

  const scoredGame = (
    id: string,
    playedAt: number,
    winner: string,
    loser: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
  ): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time: playedAt, data: { winner, loser, playedAt } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: playedAt + 1,
      data: {
        setsWon: { gameWinner: setPoints.length, gameLoser: 0 },
        setPoints,
      },
    },
  ];

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  // Mid-January 2024: safely inside the long-finished Q1 2024 season.
  const q1 = determineSeason(new Date(2024, 0, 10, 12).getTime());
  const t = (day: number) => new Date(2024, 0, day, 12).getTime();

  const soCloseOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "so-close");

  it("awards every non-winner within 10% of the winner's score — and nobody else", () => {
    // A win with all sets and all balls scores a 100 performance. Alice's
    // 11-0 win makes her season score exactly 100.
    // Bob's 11-1 win scores 25 + 25 + (11/12) * 50 ≈ 95.83 — within 10%.
    // Dave's 11-4 win scores 25 + 25 + (11/15) * 50 ≈ 86.67 — outside 10%.
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", t(10), "alice", "bob", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g2", t(11), "bob", "carol", [{ gameWinner: 11, gameLoser: 1 }]),
      ...scoredGame("g3", t(12), "dave", "erin", [{ gameWinner: 11, gameLoser: 4 }]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // The winner is Alice — she never earns So Close.
    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "season-winner")).toHaveLength(1);
    expect(soCloseOf(tt, "alice")).toHaveLength(0);

    const bob = soCloseOf(tt, "bob");
    expect(bob).toHaveLength(1);
    expect(bob[0].earnedAt).toBe(q1.end);
    expect(bob[0].data?.seasonStart).toBe(q1.start);
    expect(bob[0].data?.winner).toBe("alice");
    expect(bob[0].data?.winnerScore).toBeCloseTo(100);
    expect(bob[0].data?.playerScore).toBeCloseTo(95.833, 2);

    expect(soCloseOf(tt, "carol")).toHaveLength(0);
    expect(soCloseOf(tt, "dave")).toHaveLength(0);
    expect(soCloseOf(tt, "erin")).toHaveLength(0);
  });

  it("awards any rank within the band — a three-way score tie earns it at rank 2 AND rank 3", () => {
    // Every win is 11-0, pinning each winning performance at exactly 100.
    // Alice, Bob and Carol all finish on 200; the fewer-pairings tiebreaker
    // ranks Alice (2 matchups) above Bob (3) above Carol (4). Bob and Carol
    // both matched the winning score, so both are So Close.
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", t(8), "alice", "bob", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g2", t(9), "alice", "carol", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g3", t(10), "bob", "carol", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g4", t(11), "bob", "dave", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g5", t(12), "carol", "dave", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g6", t(13), "carol", "erin", [{ gameWinner: 11, gameLoser: 0 }]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const seasonWinners = tt.achievements.getAchievements("alice").filter((a) => a.type === "season-winner");
    expect(seasonWinners).toHaveLength(1);

    expect(soCloseOf(tt, "alice")).toHaveLength(0);
    expect(soCloseOf(tt, "bob")).toHaveLength(1);
    expect(soCloseOf(tt, "carol")).toHaveLength(1);
    expect(soCloseOf(tt, "dave")).toHaveLength(0);
    expect(soCloseOf(tt, "erin")).toHaveLength(0);
  });

  it("is not awarded while the season is still running", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 1, 1, 12).getTime()); // inside the Q1 2024 season

    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", t(10), "alice", "bob", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g2", t(11), "bob", "carol", [{ gameWinner: 11, gameLoser: 1 }]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(soCloseOf(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "season-winner")).toHaveLength(0);

    jest.useRealTimers();
  });

  it("is earned once per qualifying season", () => {
    // Bob finishes within 10% in Q1 AND Q2 2024.
    const q2Time = (day: number) => new Date(2024, 3, day, 12).getTime();
    const events: EventType[] = [
      ...baseEvents,
      ...scoredGame("g1", t(10), "alice", "bob", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g2", t(11), "bob", "carol", [{ gameWinner: 11, gameLoser: 1 }]),
      ...scoredGame("g3", q2Time(10), "alice", "bob", [{ gameWinner: 11, gameLoser: 0 }]),
      ...scoredGame("g4", q2Time(11), "bob", "carol", [{ gameWinner: 11, gameLoser: 1 }]),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const bob = soCloseOf(tt, "bob");
    expect(bob).toHaveLength(2);
    expect(bob[0].data?.seasonStart).toBe(q1.start);
    expect(bob[1].data?.seasonStart).toBe(determineSeason(q2Time(10)).start);
    expect(tt.achievements.getPlayerProgression("bob")["so-close"].earned).toBe(2);
  });

  // A game with no recorded score still counts: the winner performs 25 (win
  // only), the loser 0. So a single unscored win makes the winner's 25 the
  // winning score, and only score ties can be within 10% of it.
  it("works for seasons of unscored games", () => {
    const events: EventType[] = [...baseEvents, game("g1", t(10), "alice", "bob"), game("g2", t(11), "bob", "carol")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Alice and Bob both scored 25; Alice wins on fewer pairings. Bob's tied
    // score is within 10%.
    expect(soCloseOf(tt, "alice")).toHaveLength(0);
    expect(soCloseOf(tt, "bob")).toHaveLength(1);
    expect(soCloseOf(tt, "carol")).toHaveLength(0);
  });
});
