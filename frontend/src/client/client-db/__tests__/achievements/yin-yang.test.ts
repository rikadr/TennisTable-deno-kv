import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Yin Yang: the league record for the longest run of strictly alternating
// results — win, loss, win, loss (or the mirror). The first run to reach 5
// games establishes the record; after that only a longer run takes it. While
// the holder keeps alternating, the award grows with the run instead of
// handing out one per game.

describe("Yin Yang Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
  ];

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // Alice alternates W L W L W ... — wins against Bob, losses to Carol — so
  // neither opponent builds an alternating run of their own (Bob only ever
  // loses, Carol only ever wins).
  const aliceAlternation = (games: number, startTime: number): EventType[] => {
    const events: EventType[] = [];
    for (let i = 0; i < games; i++) {
      const time = startTime + i * 10;
      if (i % 2 === 0) events.push(game(`a-${i}`, time, "alice", "bob"));
      else events.push(game(`a-${i}`, time, "carol", "alice"));
    }
    return events;
  };

  const yinYangs = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "yin-yang");

  it("establishes the first record at 5 alternating results", () => {
    const events: EventType[] = [...baseEvents, ...aliceAlternation(5, 100)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = yinYangs(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0]).toStrictEqual({
      type: "yin-yang",
      earnedBy: "alice",
      earnedAt: 140,
      data: { streakLength: 5, startedAt: 100, previousRecord: undefined },
    });
    expect(tt.achievements.yinYangRecord).toStrictEqual({ length: 5, holder: "alice" });
  });

  it("does NOT award below the 5-game floor", () => {
    const events: EventType[] = [...baseEvents, ...aliceAlternation(4, 100)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(yinYangs(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.yinYangRecord.length).toBeUndefined();
  });

  it("grows the holder's award as the alternation continues, instead of awarding again", () => {
    const events: EventType[] = [...baseEvents, ...aliceAlternation(7, 100)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = yinYangs(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].data.streakLength).toBe(7);
    expect(awards[0].data.startedAt).toBe(100);
    // earnedAt moves with the run — the 7th game.
    expect(awards[0].earnedAt).toBe(160);
    expect(tt.achievements.yinYangRecord).toStrictEqual({ length: 7, holder: "alice" });
  });

  it("a repeated result breaks the run", () => {
    // Alice: W W L W L — the double win means no run ever passes 4.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", 100, "alice", "bob"),
      game("g2", 110, "alice", "bob"),
      game("g3", 120, "carol", "alice"),
      game("g4", 130, "alice", "bob"),
      game("g5", 140, "carol", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(yinYangs(tt, "alice")).toHaveLength(0);
  });

  it("a standing record must be strictly exceeded", () => {
    const events: EventType[] = [
      ...baseEvents,
      // Alice sets the record at 5, then breaks her own run with a repeat win.
      ...aliceAlternation(5, 100),
      game("a-break", 150, "alice", "bob"),
      // Dave alternates 6: W L W L W L (wins vs Bob, losses to Carol).
      game("d-0", 200, "dave", "bob"),
      game("d-1", 210, "carol", "dave"),
      game("d-2", 220, "dave", "bob"),
      game("d-3", 230, "carol", "dave"),
      game("d-4", 240, "dave", "bob"),
      game("d-5", 250, "carol", "dave"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Dave's run of 5 (at time 240) only matches the record — no award until
    // the 6th alternating result exceeds it.
    const daveAwards = yinYangs(tt, "dave");
    expect(daveAwards).toHaveLength(1);
    expect(daveAwards[0].data.streakLength).toBe(6);
    expect(daveAwards[0].data.previousRecord).toBe(5);
    expect(daveAwards[0].earnedAt).toBe(250);
    // Alice keeps the award her record run earned, at the length it held.
    const aliceAwards = yinYangs(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.streakLength).toBe(5);
    expect(tt.achievements.yinYangRecord).toStrictEqual({ length: 6, holder: "dave" });
  });

  it("a pure head-to-head see-saw: the winner takes the tie, then the record trades", () => {
    // Alice and Bob trade wins for 6 games (Alice wins the odd games). Both
    // runs reach 5 on game 5 — the winner (Alice) is checked first and takes
    // the record. On game 6 Bob's run reaches 6 first (he won it) and takes
    // the record over.
    const events: EventType[] = [
      ...baseEvents,
      game("g1", 100, "alice", "bob"),
      game("g2", 110, "bob", "alice"),
      game("g3", 120, "alice", "bob"),
      game("g4", 130, "bob", "alice"),
      game("g5", 140, "alice", "bob"),
      game("g6", 150, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aliceAwards = yinYangs(tt, "alice");
    expect(aliceAwards).toHaveLength(1);
    expect(aliceAwards[0].data.streakLength).toBe(5);
    const bobAwards = yinYangs(tt, "bob");
    expect(bobAwards).toHaveLength(1);
    expect(bobAwards[0].data.streakLength).toBe(6);
    expect(bobAwards[0].data.previousRecord).toBe(5);
    expect(tt.achievements.yinYangRecord).toStrictEqual({ length: 6, holder: "bob" });
  });

  describe("Progression", () => {
    it("tracks the live run and the longest ever, with no target before a record exists", () => {
      // Alice: W L W W — the repeat breaks a run of 3; the live run is 1.
      const events: EventType[] = [
        ...baseEvents,
        game("g1", 100, "alice", "bob"),
        game("g2", 110, "carol", "alice"),
        game("g3", 120, "alice", "bob"),
        game("g4", 130, "alice", "bob"),
      ];

      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();

      const progression = tt.achievements.getPlayerProgression("alice")["yin-yang"];
      expect(progression.current).toBe(1);
      expect(progression.best).toBe(3);
      expect(progression.target).toBeUndefined();
      expect(progression.recordHolder).toBeUndefined();
      expect(progression.earned).toBe(0);
    });

    it("targets one beyond the record once it exists, naming the holder", () => {
      const events: EventType[] = [
        ...baseEvents,
        ...aliceAlternation(5, 100),
        // Dave has a live alternation of 2.
        game("d-0", 200, "dave", "bob"),
        game("d-1", 210, "carol", "dave"),
      ];

      const tt = new TennisTable({ events });
      tt.achievements.calculateAchievements();

      const progression = tt.achievements.getPlayerProgression("dave")["yin-yang"];
      expect(progression.current).toBe(2);
      expect(progression.best).toBe(2);
      expect(progression.target).toBe(6);
      expect(progression.recordHolder).toBe("alice");
    });
  });
});
