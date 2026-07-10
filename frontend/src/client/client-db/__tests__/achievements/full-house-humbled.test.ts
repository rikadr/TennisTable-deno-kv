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

  it("ignores results against players who are no longer ranked active", () => {
    // A beats B, C, D, E. Then E is deactivated, dropping the ranked cohort
    // to 4 (A, B, C, D). Full House now needs ≥5 ranked active — the gate
    // fails and A gets nothing despite having beaten everyone historically.
    const events = [...fivePlayerSetup(), deactivate("e", 5000)];
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
