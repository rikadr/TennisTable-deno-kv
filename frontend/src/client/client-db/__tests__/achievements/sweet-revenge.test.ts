import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

describe("Sweet Revenge Achievement", () => {
  const players: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "dave", time: 4, data: { name: "Dave" } },
  ];

  const T1_START = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const T2_START = Date.now() - 20 * 24 * 60 * 60 * 1000;
  const T3_START = Date.now() - 10 * 24 * 60 * 60 * 1000;

  function game(stream: string, time: number, winner: string, loser: string): EventType {
    return {
      type: EventTypeEnum.GAME_CREATED,
      stream,
      time,
      data: { winner, loser, playedAt: time },
    };
  }

  // A 2-player bracket-only tournament is a single final between the two
  // players — the smallest possible tournament match.
  function twoPlayerTournament(id: string, name: string, startDate: number, playerOrder: string[]): EventType[] {
    return [
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: id,
        time: startDate - 1000,
        data: { name, startDate, groupPlay: false },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: id,
        time: startDate - 999,
        data: { playerOrder },
      },
    ];
  }

  function revengeAwards(tt: TennisTable, playerId: string) {
    return tt.achievements.getAchievements(playerId).filter((a) => a.type === "sweet-revenge");
  }

  it("awards a win over an opponent who beat you in an earlier tournament", () => {
    const events: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
      ...twoPlayerTournament("t2", "Autumn Cup", T2_START, ["alice", "bob"]),
      game("g2", T2_START + 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toStrictEqual([
      {
        type: "sweet-revenge",
        earnedBy: "alice",
        earnedAt: T2_START + 100,
        data: {
          opponent: "bob",
          tournamentId: "t2",
          lostAt: T1_START + 100,
          lostTournamentId: "t1",
        },
      },
    ]);
    // Bob has no tournament loss to alice before his win, so no award.
    expect(revengeAwards(tt, "bob")).toHaveLength(0);
  });

  it("does NOT award a first win — only a win after a tournament loss to that opponent", () => {
    const events: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "alice", "bob"),
      ...twoPlayerTournament("t2", "Autumn Cup", T2_START, ["alice", "bob"]),
      game("g2", T2_START + 100, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // Alice won first — nothing to avenge. Bob avenges his t1 loss in t2.
    expect(revengeAwards(tt, "alice")).toHaveLength(0);
    expect(revengeAwards(tt, "bob")).toHaveLength(1);
    expect(revengeAwards(tt, "bob")[0].data).toStrictEqual({
      opponent: "alice",
      tournamentId: "t2",
      lostAt: T1_START + 100,
      lostTournamentId: "t1",
    });
  });

  it("does NOT count a league (non-tournament) loss as a loss to avenge", () => {
    const events: EventType[] = [
      ...players,
      // Bob beats alice in a plain league game, before any tournament.
      game("g1", T1_START - 5000, "bob", "alice"),
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g2", T1_START + 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toHaveLength(0);
  });

  it("does NOT count a league (non-tournament) win as revenge", () => {
    const events: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
      // The t1 final is done, so this alice win is a plain league game.
      game("g2", T1_START + 200, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toHaveLength(0);
  });

  it("does NOT count a skipped loss as a defeat to avenge", () => {
    const events: EventType[] = [
      ...players,
      // t1: alice "loses" the final by skipping — a walkover, not a defeat.
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t1",
        time: T1_START + 100,
        data: { skipId: "skip1", winner: "bob", loser: "alice" },
      },
      // t2: alice beats bob for real — but there is no played loss to avenge.
      ...twoPlayerTournament("t2", "Summer Cup", T2_START, ["alice", "bob"]),
      game("g1", T2_START + 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toHaveLength(0);
    expect(revengeAwards(tt, "bob")).toHaveLength(0);
  });

  it("does NOT count a skipped win as revenge — a later real win still is", () => {
    const events: EventType[] = [
      ...players,
      // t1: bob beats alice for real.
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
      // t2: alice "wins" by bob skipping — a walkover is not revenge.
      ...twoPlayerTournament("t2", "Summer Cup", T2_START, ["alice", "bob"]),
      {
        type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
        stream: "t2",
        time: T2_START + 100,
        data: { skipId: "skip1", winner: "alice", loser: "bob" },
      },
      // t3: alice beats bob for real — THIS avenges the t1 loss.
      ...twoPlayerTournament("t3", "Autumn Cup", T3_START, ["alice", "bob"]),
      game("g2", T3_START + 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const awards = revengeAwards(tt, "alice");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedAt).toBe(T3_START + 100);
    expect(awards[0].data).toStrictEqual({
      opponent: "bob",
      tournamentId: "t3",
      lostAt: T1_START + 100,
      lostTournamentId: "t1",
    });
  });

  it("is earned once per opponent, even across repeated revenge cycles", () => {
    const events: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Cup 1", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
      ...twoPlayerTournament("t2", "Cup 2", T2_START, ["alice", "bob"]),
      game("g2", T2_START + 100, "alice", "bob"), // Revenge #1
      ...twoPlayerTournament("t3", "Cup 3", T3_START, ["alice", "bob"]),
      game("g3", T3_START + 100, "bob", "alice"), // Bob avenges his t2 loss
      ...twoPlayerTournament("t4", "Cup 4", T3_START + 1000, ["alice", "bob"]),
      game("g4", T3_START + 1100, "alice", "bob"), // Same opponent — no 2nd award
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toHaveLength(1);
    expect(revengeAwards(tt, "bob")).toHaveLength(1);
  });

  it("counts a group play loss as a loss to avenge", () => {
    const events: EventType[] = [
      ...players,
      {
        type: EventTypeEnum.TOURNAMENT_CREATED,
        stream: "t1",
        time: 1000,
        data: { name: "Group Cup", startDate: T1_START, groupPlay: true },
      },
      {
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        stream: "t1",
        time: 1001,
        data: { playerOrder: ["alice", "bob", "carol", "dave"] },
      },
      // Bob beats alice in their group play match. The group stays
      // unfinished — played group matches count regardless.
      game("g1", T1_START + 100, "bob", "alice"),
      // Alice gets bob back in a later tournament.
      ...twoPlayerTournament("t2", "Autumn Cup", T2_START, ["alice", "bob"]),
      game("g2", T2_START + 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(revengeAwards(tt, "alice")).toStrictEqual([
      {
        type: "sweet-revenge",
        earnedBy: "alice",
        earnedAt: T2_START + 100,
        data: {
          opponent: "bob",
          tournamentId: "t2",
          lostAt: T1_START + 100,
          lostTournamentId: "t1",
        },
      },
    ]);
  });

  it("progression lists the rivals still to avenge, and clears them once avenged", () => {
    const beforeRevenge: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
    ];

    const tt1 = new TennisTable({ events: beforeRevenge });
    tt1.achievements.calculateAchievements();
    expect(tt1.achievements.getPlayerProgression("alice")["sweet-revenge"]).toStrictEqual({
      current: 0,
      target: 1,
      missing: new Set(["bob"]),
      earned: 0,
    });

    const afterRevenge: EventType[] = [
      ...beforeRevenge,
      ...twoPlayerTournament("t2", "Autumn Cup", T2_START, ["alice", "bob"]),
      game("g2", T2_START + 100, "alice", "bob"),
    ];

    const tt2 = new TennisTable({ events: afterRevenge });
    tt2.achievements.calculateAchievements();
    expect(tt2.achievements.getPlayerProgression("alice")["sweet-revenge"]).toStrictEqual({
      current: 1,
      target: 1,
      missing: new Set(),
      earned: 1,
    });
  });

  it("progression drops rivals who are no longer active players", () => {
    const events: EventType[] = [
      ...players,
      ...twoPlayerTournament("t1", "Spring Cup", T1_START, ["alice", "bob"]),
      game("g1", T1_START + 100, "bob", "alice"),
      { type: EventTypeEnum.PLAYER_DEACTIVATED, stream: "bob", time: T1_START + 200, data: null },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("alice")["sweet-revenge"]).toStrictEqual({
      current: 0,
      target: 0,
      missing: new Set(),
      earned: 0,
    });
  });
});
