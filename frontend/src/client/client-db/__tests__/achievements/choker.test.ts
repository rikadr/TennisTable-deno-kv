import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { CHOKER_RECORD_FLOOR } from "../../achievements";

// Choker: lose a set after a lead that equals or beats the league record for
// the largest lead lost. Only games tracked point by point count. A lead of
// CHOKER_RECORD_FLOOR establishes the first record. An equal lead earns the
// award again but leaves the record with its holder.

describe("Choker Achievement", () => {
  const baseEvents: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "chris", time: 3, data: { name: "Chris" } },
  ];

  // A set the game loser loses after a lead of `lead` points: the game loser
  // takes the first `lead` points, then the game winner takes 11 in a row.
  const setLostAfterLead = (lead: number) => "L".repeat(lead) + "W".repeat(11);

  // A 2-0 game. Set 1 is the one the game loser loses after a lead; set 2 is
  // a plain 11–0 with no lead for the game loser.
  const trackedGame = (id: string, time: number, winner: string, loser: string, lead: number): EventType[] => [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner, loser, playedAt: time } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: lead },
          { gameWinner: 11, gameLoser: 0 },
        ],
        pointSequences: [setLostAfterLead(lead), "W".repeat(11)],
      },
    },
  ];

  const chokers = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "choker");

  it("awards the set loser when a lead reaches the floor, and sets the first record", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...trackedGame("g1", 100, "alice", "bob", CHOKER_RECORD_FLOOR)],
    });
    tt.achievements.calculateAchievements();

    const awards = chokers(tt, "bob");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(100);
    expect(awards[0].earnedByGame).toBe("g1");
    expect(awards[0].data).toEqual({
      gameId: "g1",
      opponent: "alice",
      setNumber: 1,
      lead: CHOKER_RECORD_FLOOR,
      leadPoints: CHOKER_RECORD_FLOOR,
      leadOpponentPoints: 0,
      setLoserPoints: CHOKER_RECORD_FLOOR,
      setWinnerPoints: 11,
      previousRecord: undefined,
    });
    expect(chokers(tt, "alice")).toHaveLength(0);
    expect(tt.achievements.chokerRecord).toEqual({ lead: CHOKER_RECORD_FLOOR, holder: "bob" });
  });

  it("does NOT award a lead below the floor while no record exists", () => {
    const tt = new TennisTable({
      events: [...baseEvents, ...trackedGame("g1", 100, "alice", "bob", CHOKER_RECORD_FLOOR - 1)],
    });
    tt.achievements.calculateAchievements();

    expect(chokers(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.chokerRecord.lead).toBeUndefined();
    expect(tt.achievements.getPlayerProgression("bob").choker.current).toBe(CHOKER_RECORD_FLOOR - 1);
  });

  it("awards a lead that equals the record, and keeps the record with its holder", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", 6),
        ...trackedGame("g2", 200, "alice", "chris", 6),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(chokers(tt, "bob")).toHaveLength(1);
    const chrisAwards = chokers(tt, "chris");
    expect(chrisAwards).toHaveLength(1);
    expect(chrisAwards[0].data.previousRecord).toBe(6);
    expect(tt.achievements.chokerRecord).toEqual({ lead: 6, holder: "bob" });
  });

  it("awards a lead that beats the record, and moves the record", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", 6),
        ...trackedGame("g2", 200, "alice", "chris", 8),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(chokers(tt, "chris")).toHaveLength(1);
    expect(tt.achievements.chokerRecord).toEqual({ lead: 8, holder: "chris" });
  });

  it("does NOT award a lead below the record", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, "alice", "bob", 8),
        ...trackedGame("g2", 200, "alice", "chris", 7),
      ],
    });
    tt.achievements.calculateAchievements();

    expect(chokers(tt, "chris")).toHaveLength(0);
    const progression = tt.achievements.getPlayerProgression("chris").choker;
    expect(progression.current).toBe(7);
    expect(progression.target).toBe(8);
    expect(progression.recordHolder).toBe("bob");
  });

  it("does NOT count games without a point log", () => {
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        {
          type: EventTypeEnum.GAME_CREATED,
          stream: "g1",
          time: 100,
          data: { winner: "alice", loser: "bob", playedAt: 100 },
        },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream: "g1",
          time: 101,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 0 },
            setPoints: [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 11, gameLoser: 9 },
            ],
          },
        },
      ],
    });
    tt.achievements.calculateAchievements();

    expect(chokers(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("bob").choker.current).toBe(0);
  });

  it("uses the largest lead in the set, not the last one", () => {
    // Bob leads 6–0, falls back to 6–6, leads 8–6 and then loses 9–11.
    const sequence = ["LLLLLL", "WWWWWW", "LL", "WW", "L", "WWW"].join("");
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        {
          type: EventTypeEnum.GAME_CREATED,
          stream: "g1",
          time: 100,
          data: { winner: "alice", loser: "bob", playedAt: 100 },
        },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream: "g1",
          time: 101,
          data: {
            setsWon: { gameWinner: 1, gameLoser: 0 },
            setPoints: [{ gameWinner: 11, gameLoser: 9 }],
            pointSequences: [sequence],
          },
        },
      ],
    });
    tt.achievements.calculateAchievements();

    const awards = chokers(tt, "bob");
    expect(awards).toHaveLength(1);
    expect(awards[0].data).toMatchObject({ lead: 6, leadPoints: 6, leadOpponentPoints: 0 });
    expect(awards[0].data).toMatchObject({ setLoserPoints: 9, setWinnerPoints: 11 });
  });

  it("awards the game winner for a set they lost", () => {
    // Alice wins the game 2–1, but loses set 1 after a 7–0 lead.
    const tt = new TennisTable({
      events: [
        ...baseEvents,
        {
          type: EventTypeEnum.GAME_CREATED,
          stream: "g1",
          time: 100,
          data: { winner: "alice", loser: "bob", playedAt: 100 },
        },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream: "g1",
          time: 101,
          data: {
            setsWon: { gameWinner: 2, gameLoser: 1 },
            setPoints: [
              { gameWinner: 9, gameLoser: 11 },
              { gameWinner: 11, gameLoser: 0 },
              { gameWinner: 11, gameLoser: 0 },
            ],
            pointSequences: ["W".repeat(7) + "L".repeat(11) + "WW", "W".repeat(11), "W".repeat(11)],
          },
        },
      ],
    });
    tt.achievements.calculateAchievements();

    const awards = chokers(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].data).toMatchObject({ opponent: "bob", setNumber: 1, lead: 7, setLoserPoints: 9 });
    expect(chokers(tt, "bob")).toHaveLength(0);
  });
});
