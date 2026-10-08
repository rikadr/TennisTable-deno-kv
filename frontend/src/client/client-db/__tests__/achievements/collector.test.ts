import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Collector: win a set 11–x with every x from 0 to 9. Either player of a game
// can win a set. One-time achievement, awarded at the game that wins the last
// missing score.

describe("Collector Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
  ];

  const scoredGame = (
    id: string,
    time: number,
    winner: string,
    loser: string,
    setPoints: { gameWinner: number; gameLoser: number }[],
  ): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: {
          gameWinner: setPoints.filter((set) => set.gameWinner > set.gameLoser).length,
          gameLoser: setPoints.filter((set) => set.gameLoser > set.gameWinner).length,
        },
        setPoints,
      },
    },
  ];

  // Alice wins 2 sets in each game: 11–0 and 11–1, then 11–2 and 11–3, and so on.
  const collectAllScores = (): EventType[] => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 5; i++) {
      events.push(
        ...scoredGame(`g${i}`, 100 + i * 10, "alice", "bob", [
          { gameWinner: 11, gameLoser: 2 * i },
          { gameWinner: 11, gameLoser: 2 * i + 1 },
        ]),
      );
    }
    return events;
  };

  const collectorAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "collector");

  it("awards at the game that wins the last missing score", () => {
    const tt = new TennisTable({ events: collectAllScores() });
    tt.achievements.calculateAchievements();

    const awards = collectorAwards(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(140);
    expect(awards[0].earnedByGame).toBe("g4");
    expect(collectorAwards(tt, "bob")).toHaveLength(0);
  });

  it("awards only once", () => {
    const events = collectAllScores();
    events.push(...scoredGame("again", 200, "alice", "bob", [{ gameWinner: 11, gameLoser: 5 }]));
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(collectorAwards(tt, "alice")).toHaveLength(1);
  });

  it("counts a set that the game loser wins", () => {
    const events: EventType[] = [...baseEvents];
    for (let i = 0; i < 10; i++) {
      // Bob loses every game, but wins the 2nd set 11–i.
      events.push(
        ...scoredGame(`g${i}`, 100 + i * 10, "alice", "bob", [
          { gameWinner: 11, gameLoser: 9 },
          { gameWinner: i, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 9 },
        ]),
      );
    }
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(collectorAwards(tt, "bob")).toHaveLength(1);
    expect(collectorAwards(tt, "bob")[0].earnedAt).toBe(190);
  });

  it("does not count a deuce set as 11–10", () => {
    const events: EventType[] = [...baseEvents];
    events.push(...scoredGame("deuce", 100, "alice", "bob", [{ gameWinner: 12, gameLoser: 10 }]));
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("alice").collector;
    expect(progression.current).toBe(0);
    expect(progression.missingScores).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("shows the scores collected and the scores still missing", () => {
    const events: EventType[] = [...baseEvents];
    events.push(
      ...scoredGame("g1", 100, "alice", "bob", [
        { gameWinner: 11, gameLoser: 3 },
        { gameWinner: 11, gameLoser: 3 },
        { gameWinner: 7, gameLoser: 11 },
      ]),
    );
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const alice = tt.achievements.getPlayerProgression("alice").collector;
    expect(alice.current).toBe(1);
    expect(alice.target).toBe(10);
    expect(alice.missingScores).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
    expect(alice.earned).toBe(0);

    const bob = tt.achievements.getPlayerProgression("bob").collector;
    expect(bob.current).toBe(1);
    expect(bob.missingScores).toEqual([0, 1, 2, 3, 4, 5, 6, 8, 9]);
  });
});
