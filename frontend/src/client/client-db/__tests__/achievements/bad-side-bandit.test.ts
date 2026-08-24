import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Bad Side Bandit: win 10 sets from the bad side of the table. A set counts
// when the game records the side of the set ("B" = the game winner had the
// bad side, "G" = the game loser had it) and the points of the set name the
// player on the bad side as the set winner. Either player can win a
// qualifying set, whoever wins the game. One-time achievement, awarded on the
// crossing.

describe("Bad Side Bandit Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "chris", time: 3, data: { name: "Chris" } },
  ];

  type SetPoints = { gameWinner: number; gameLoser: number };
  type Side = "G" | "B" | "N" | null;

  const game = (params: {
    id: string;
    time: number;
    winner: string;
    loser: string;
    setPoints?: SetPoints[];
    sides?: Side[];
  }): EventType[] => {
    const { id, time, winner, loser, setPoints, sides } = params;
    const setsWon = {
      gameWinner: (setPoints ?? []).filter((set) => set.gameWinner > set.gameLoser).length,
      gameLoser: (setPoints ?? []).filter((set) => set.gameLoser > set.gameWinner).length,
    };
    return [
      { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
      {
        type: EventTypeEnum.GAME_SCORE,
        stream: id,
        time: time + 1,
        data: { setsWon, setPoints, gameWinnerSides: sides },
      },
    ];
  };

  // A 2-0 game where the game winner had the bad side in both sets, so the
  // game winner takes 2 qualifying sets and the game loser none.
  const twoBadSideSetsForWinner = (id: string, time: number, winner: string, loser: string): EventType[] =>
    game({
      id,
      time,
      winner,
      loser,
      setPoints: [
        { gameWinner: 11, gameLoser: 4 },
        { gameWinner: 11, gameLoser: 6 },
      ],
      sides: ["B", "B"],
    });

  const awardsOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "bad-side-bandit");

  const progressOf = (tt: TennisTable, playerId: string) =>
    tt.achievements.getPlayerProgression(playerId)["bad-side-bandit"];

  const calculated = (events: EventType[]): TennisTable => {
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    return tt;
  };

  it("awards after 10 sets won on the bad side, stamped at the crossing game", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 5; i++) {
      events.push(...twoBadSideSetsForWinner(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = calculated(events);

    const awards = awardsOf(tt, "alice");
    expect(awards).toHaveLength(1);
    // The 5th game, which takes Alice from 8 sets to 10, is played at 140.
    expect(awards[0].earnedAt).toBe(140);
  });

  it("awards the game loser for the sets they won on the bad side", () => {
    // Bob loses every game 1-2, but the 1 set he wins is from the bad side:
    // "G" means the game winner had the good side, so Bob had the bad one.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 5 },
            { gameWinner: 7, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 9 },
          ],
          sides: ["B", "G", "N"],
        }),
      );
    }

    const tt = calculated(events);

    // Bob won 1 bad-side set per game and crosses on the 10th, at time 190.
    const bobAwards = awardsOf(tt, "bob");
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].earnedAt).toBe(190);
    // Alice won set 1 from the bad side too, so she crosses at the same game.
    expect(awardsOf(tt, "alice")).toHaveLength(1);
  });

  it("does NOT count a set the player won from the good side", () => {
    // The game winner takes both sets, but from the good side every time.
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 4 },
            { gameWinner: 11, gameLoser: 6 },
          ],
          sides: ["G", "G"],
        }),
      );
    }

    const tt = calculated(events);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(0);
    // Bob was on the bad side of both sets and lost both, so he gets nothing.
    expect(progressOf(tt, "bob").current).toBe(0);
  });

  it("does NOT count a set with 2 equally good sides", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 4 },
            { gameWinner: 11, gameLoser: 6 },
          ],
          sides: ["N", "N"],
        }),
      );
    }

    const tt = calculated(events);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(0);
  });

  it("does NOT count a set with no recorded side", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      // Only the first set has a side. The second one is unrecorded.
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 4 },
            { gameWinner: 11, gameLoser: 6 },
          ],
          sides: ["B", null],
        }),
      );
    }

    const tt = calculated(events);

    // 1 counted set per game: 10 games take Alice exactly to the target.
    const awards = awardsOf(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(190);
  });

  it("does NOT count a game that records the sides without the points", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(
        ...[
          {
            type: EventTypeEnum.GAME_CREATED,
            stream: `g${i}`,
            time: 100 + i * 10,
            data: { winner: "alice", loser: "bob", playedAt: 100 + i * 10 },
          } as EventType,
          {
            type: EventTypeEnum.GAME_SCORE,
            stream: `g${i}`,
            time: 100 + i * 10 + 1,
            data: { setsWon: { gameWinner: 2, gameLoser: 0 }, gameWinnerSides: ["B", "B"] },
          } as EventType,
        ],
      );
    }

    const tt = calculated(events);

    // Who won each set is unknown without the points, so nothing counts.
    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(0);
  });

  it("does NOT count a game that records the points without the sides", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 4 },
            { gameWinner: 11, gameLoser: 6 },
          ],
        }),
      );
    }

    const tt = calculated(events);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(0);
  });

  it("does NOT award before the 10th set", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 4; i++) {
      events.push(...twoBadSideSetsForWinner(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = calculated(events);

    expect(awardsOf(tt, "alice")).toHaveLength(0);
    expect(progressOf(tt, "alice").current).toBe(8);
  });

  it("awards on the game that crosses the target, not only on an exact hit", () => {
    const events: EventType[] = [...baseEvents];
    // 3 sets per game: 3 games give 9 sets, and the 4th game crosses from 9.
    for (let i = 0; i < 4; i++) {
      events.push(
        ...game({
          id: `g${i}`,
          time: 100 + i * 10,
          winner: "alice",
          loser: "bob",
          setPoints: [
            { gameWinner: 11, gameLoser: 4 },
            { gameWinner: 4, gameLoser: 11 },
            { gameWinner: 11, gameLoser: 6 },
          ],
          sides: ["B", "G", "B"],
        }),
      );
    }

    const tt = calculated(events);

    // Alice wins sets 1 and 3 from the bad side: 2 per game, 8 after 4 games.
    expect(progressOf(tt, "alice").current).toBe(8);
    // Bob wins set 2 from the bad side: 1 per game, 4 after 4 games.
    expect(progressOf(tt, "bob").current).toBe(4);

    const events5 = [...events, ...twoBadSideSetsForWinner("g4", 200, "alice", "bob")];
    const tt5 = calculated(events5);

    // Alice goes from 8 to 10 in one game and is awarded at that game.
    const awards = awardsOf(tt5, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(200);
  });

  it("counts sets against different opponents", () => {
    const events: EventType[] = [
      ...baseEvents,
      ...twoBadSideSetsForWinner("g1", 100, "alice", "bob"),
      ...twoBadSideSetsForWinner("g2", 110, "alice", "chris"),
      ...twoBadSideSetsForWinner("g3", 120, "alice", "bob"),
      ...twoBadSideSetsForWinner("g4", 130, "alice", "chris"),
      ...twoBadSideSetsForWinner("g5", 140, "alice", "bob"),
    ];

    const tt = calculated(events);

    const awards = awardsOf(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(140);
    // Neither opponent won a set, so neither has any progress.
    expect(progressOf(tt, "bob").current).toBe(0);
    expect(progressOf(tt, "chris").current).toBe(0);
  });

  it("is awarded only once, even as the count keeps growing", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 12; i++) {
      events.push(...twoBadSideSetsForWinner(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = calculated(events);

    expect(awardsOf(tt, "alice")).toHaveLength(1);
  });

  it("caps progression at the target so the career total is not exposed", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 12; i++) {
      events.push(...twoBadSideSetsForWinner(`g${i}`, 100 + i * 10, "alice", "bob"));
    }

    const tt = calculated(events);

    const progression = progressOf(tt, "alice");
    expect(progression.current).toBe(10);
    expect(progression.target).toBe(10);
    expect(progression.earned).toBe(1);
  });
});
