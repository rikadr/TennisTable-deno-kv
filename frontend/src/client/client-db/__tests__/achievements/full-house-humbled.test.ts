import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Full House: beat every currently ranked player at least once.
// Humbled: lose to every currently ranked player at least once.
// The target cohort is the CURRENT leaderboard (ranked players now, i.e.
// active players with enough games), and each requires ≥5 ranked players to
// be earnable — matching the cohort gate used by the rank achievements.
// Default GuestClient has gameLimitForRanked = 5.

describe("Full House & Humbled Achievements", () => {
  const createPlayer = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  const deactivate = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_DEACTIVATED,
    data: null,
  });

  // 5-player double round-robin (20 games). Every player ends with 8 games
  // (all ranked). Standings: A(rank1) B C D E(rank5).
  const fivePlayerSetup = (): EventType[] => {
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
    ];
    const pairs: [string, string][] = [
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
      ["a", "e"],
      ["b", "c"],
      ["b", "d"],
      ["b", "e"],
      ["c", "d"],
      ["c", "e"],
      ["d", "e"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    return events;
  };

  it("awards Full House when a player has beaten every currently ranked player", () => {
    // In the double round-robin, A beats B, C, D and E at least once — A has
    // beaten all 4 other ranked players, so Full House fires for A.
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const fullHouse = tt.achievements.getAchievements("a").filter((x) => x.type === "full-house");
    expect(fullHouse).toHaveLength(1);
  });

  it("awards Humbled when a player has lost to every currently ranked player", () => {
    // E loses to A, B, C and D at least once — Humbled fires for E.
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const humbled = tt.achievements.getAchievements("e").filter((x) => x.type === "humbled");
    expect(humbled).toHaveLength(1);
  });

  it("does NOT award Full House to a player who has not beaten all ranked players", () => {
    // E never beats anyone → no Full House for E.
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "full-house")).toHaveLength(0);
  });

  it("does NOT award Humbled to a player who never lost to all ranked players", () => {
    // A never loses → no Humbled for A.
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "humbled")).toHaveLength(0);
  });

  it("awards each at most once", () => {
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "full-house")).toHaveLength(1);
    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "humbled")).toHaveLength(1);
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
    // 4-player double round-robin (12 games). All 4 ranked but only 4 in the
    // pool — below the ≥5 cohort gate, so neither achievement fires.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
    ];
    const pairs: [string, string][] = [
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
      ["b", "c"],
      ["b", "d"],
      ["c", "d"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "full-house")).toHaveLength(0);
    expect(tt.achievements.getAchievements("d").filter((x) => x.type === "humbled")).toHaveLength(0);
  });

  it("awards Full House the moment a deactivation removes the last unbeaten ranked player", () => {
    // 6 players. F is made ranked first and beats A (so A never beats F).
    // A then beats B, C, D, E, and B–E are brought up to ranked. With all 6
    // ranked, A is missing only F, so Full House does NOT fire. When F is
    // deactivated the cohort drops to {A,B,C,D,E} (still 5) and A has beaten
    // all of them — Full House fires, stamped at the deactivation time.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
      createPlayer("f", 6),
    ];
    // Phase 1 — F plays everyone once (F reaches 5 games → ranked first).
    // F beats A, so A can never complete the set while F is in the cohort.
    events.push(game("f-a", 100, "f", "a"));
    events.push(game("f-b", 101, "f", "b"));
    events.push(game("f-c", 102, "f", "c"));
    events.push(game("f-d", 103, "f", "d"));
    events.push(game("f-e", 104, "f", "e"));
    // Phase 2 — A beats B, C, D, E (A reaches 5 games → ranked).
    events.push(game("a-b", 110, "a", "b"));
    events.push(game("a-c", 111, "a", "c"));
    events.push(game("a-d", 112, "a", "d"));
    events.push(game("a-e", 113, "a", "e"));
    // Phase 3 — round-robin among B, C, D, E so each reaches 5 games.
    events.push(game("b-c", 120, "b", "c"));
    events.push(game("b-d", 121, "b", "d"));
    events.push(game("b-e", 122, "b", "e"));
    events.push(game("c-d", 123, "c", "d"));
    events.push(game("c-e", 124, "c", "e"));
    events.push(game("d-e", 125, "d", "e"));
    // Phase 4 — F deactivated. A's last missing target leaves the cohort.
    events.push(deactivate("f", 200));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const fullHouse = tt.achievements.getAchievements("a").filter((x) => x.type === "full-house");
    expect(fullHouse).toHaveLength(1);
    expect(fullHouse[0].earnedAt).toBe(200);
    // A is ranked, so the completed set is the cohort of 5 minus A → 4. A's
    // first game was against F at t=100.
    expect(fullHouse[0].data).toEqual({ count: 4, firstGameAt: 100 });
  });

  it("can be earned by an unranked player who beat the whole ranked field", () => {
    // gameLimitForRanked is raised to 6 so a player can beat all 5 ranked
    // players (5 games) while still being unranked themselves. A–E become
    // ranked via the double round-robin (8 games each). Z then beats all of
    // them across 5 games — Z has only 5 games (< 6) so is NOT ranked, yet
    // Full House still fires, counting all 5 beaten players.
    const events = [
      ...fivePlayerSetup(),
      createPlayer("z", 50),
      game("z-a", 2000, "z", "a"),
      game("z-b", 2001, "z", "b"),
      game("z-c", 2002, "z", "c"),
      game("z-d", 2003, "z", "d"),
      game("z-e", 2004, "z", "e"),
    ];
    const tt = new TennisTable({ events, gameLimitForRankedOverride: 6 });
    tt.achievements.calculateAchievements();

    // Sanity: Z is not on the leaderboard (only 5 games, needs 6).
    const ranked = tt.leaderboard.getLeaderboard().rankedPlayers.map((p) => p.id);
    expect(ranked).not.toContain("z");

    const fullHouse = tt.achievements.getAchievements("z").filter((x) => x.type === "full-house");
    expect(fullHouse).toHaveLength(1);
    expect(fullHouse[0].earnedAt).toBe(2004);
    // Z is unranked, so nothing is subtracted — all 5 ranked players counted.
    expect(fullHouse[0].data).toEqual({ count: 5, firstGameAt: 2000 });
  });

  it("shows 0 progress while fewer than 5 players are ranked", () => {
    // 4-player double round-robin: A beats B, C, D. Only 4 players are
    // ranked, below the ≥5 gate, so progress is reported as 0 even though A
    // has beaten every ranked opponent.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
    ];
    const outcomes: [string, string, string][] = [
      ["a-b", "a", "b"],
      ["a-c", "a", "c"],
      ["a-d", "a", "d"],
      ["b-c", "b", "c"],
      ["b-d", "b", "d"],
      ["c-d", "c", "d"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [id, winner, loser] of outcomes) {
        events.push(game(`${id}-${round}`, t++, winner, loser));
      }
    }
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aProgress = tt.achievements.getPlayerProgression("a");
    expect(aProgress["full-house"].current).toBe(0);
  });

  it("does NOT award when a deactivation drops the cohort below 5", () => {
    // 5 ranked players. A beats B, C, D but loses to E, so A is missing only
    // E. Deactivating E leaves a cohort of 4 (A, B, C, D) — below the ≥5
    // gate — so A earns nothing despite having beaten everyone still ranked.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
    ];
    const outcomes: [string, string, string][] = [
      ["a-b", "a", "b"],
      ["a-c", "a", "c"],
      ["a-d", "a", "d"],
      ["e-a", "e", "a"],
      ["b-c", "b", "c"],
      ["b-d", "b", "d"],
      ["b-e", "b", "e"],
      ["c-d", "c", "d"],
      ["c-e", "c", "e"],
      ["d-e", "d", "e"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [id, winner, loser] of outcomes) {
        events.push(game(`${id}-${round}`, t++, winner, loser));
      }
    }
    events.push(deactivate("e", 5000));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "full-house")).toHaveLength(0);
  });

  it("reflects Full House / Humbled progression against the current ranked cohort", () => {
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // A is ranked, so the target is the 5 ranked players minus A → 4.
    const aProgress = tt.achievements.getPlayerProgression("a");
    expect(aProgress["full-house"].target).toBe(4);
    expect(aProgress["full-house"].current).toBe(4);

    // E lost to all 4 other ranked players.
    const eProgress = tt.achievements.getPlayerProgression("e");
    expect(eProgress["humbled"].target).toBe(4);
    expect(eProgress["humbled"].current).toBe(4);
  });

  it("lists the players still missing from the set in progression", () => {
    // 5-player double round-robin where A beats B, C, D but loses to E both
    // rounds. A is missing only E for Full House; E is missing only A for
    // Humbled (E beats A but loses to B, C, D).
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
    ];
    const outcomes: [string, string, string][] = [
      ["a-b", "a", "b"],
      ["a-c", "a", "c"],
      ["a-d", "a", "d"],
      ["e-a", "e", "a"],
      ["b-c", "b", "c"],
      ["b-d", "b", "d"],
      ["b-e", "b", "e"],
      ["c-d", "c", "d"],
      ["c-e", "c", "e"],
      ["d-e", "d", "e"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [id, winner, loser] of outcomes) {
        events.push(game(`${id}-${round}`, t++, winner, loser));
      }
    }
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aProgress = tt.achievements.getPlayerProgression("a");
    expect(aProgress["full-house"].current).toBe(3);
    expect(aProgress["full-house"].target).toBe(4);
    expect(Array.from(aProgress["full-house"].missing!)).toEqual(["e"]);

    const eProgress = tt.achievements.getPlayerProgression("e");
    expect(Array.from(eProgress["humbled"].missing!)).toEqual(["a"]);
  });

  it("targets the full ranked count for an unranked player (no self subtraction)", () => {
    // Z plays a single game, so Z is not ranked. The target is the total
    // number of ranked players (5) with no minus-one, since Z isn't in the
    // ranked cohort. Beating A once puts Z's Full House progress at 1/5.
    const events = [...fivePlayerSetup(), createPlayer("z", 50), game("z-a", 5000, "z", "a")];
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const zProgress = tt.achievements.getPlayerProgression("z");
    expect(zProgress["full-house"].target).toBe(5);
    expect(zProgress["full-house"].current).toBe(1);
  });
});
