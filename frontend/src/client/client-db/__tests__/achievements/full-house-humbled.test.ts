import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Full House: beat every currently ranked active player at least once.
// Humbled: lose to every currently ranked active player at least once.
// The target cohort is the CURRENT leaderboard (ranked active players now),
// and each requires ≥5 ranked active players to be earnable — matching the
// cohort gate used by the rank achievements. Default GuestClient has
// gameLimitForRanked = 5.

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
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"],
      ["b", "c"], ["b", "d"], ["b", "e"],
      ["c", "d"], ["c", "e"],
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

  it("awards Full House when a player has beaten every currently ranked active player", () => {
    // In the double round-robin, A beats B, C, D and E at least once — A has
    // beaten all 4 other ranked players, so Full House fires for A.
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const fullHouse = tt.achievements.getAchievements("a").filter((x) => x.type === "full-house");
    expect(fullHouse).toHaveLength(1);
  });

  it("awards Humbled when a player has lost to every currently ranked active player", () => {
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
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
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
      ["a-b", "a", "b"], ["a-c", "a", "c"], ["a-d", "a", "d"], ["e-a", "e", "a"],
      ["b-c", "b", "c"], ["b-d", "b", "d"], ["b-e", "b", "e"],
      ["c-d", "c", "d"], ["c-e", "c", "e"], ["d-e", "d", "e"],
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

    // A is ranked, so the target pool excludes A → 4 opponents.
    const aProgress = tt.achievements.getPlayerProgression("a");
    expect(aProgress["full-house"].target).toBe(4);
    expect(aProgress["full-house"].current).toBe(4);

    // E lost to all 4 other ranked players.
    const eProgress = tt.achievements.getPlayerProgression("e");
    expect(eProgress["humbled"].target).toBe(4);
    expect(eProgress["humbled"].current).toBe(4);
  });
});
