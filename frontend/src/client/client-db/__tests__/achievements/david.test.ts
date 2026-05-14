import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// David fires when the winner gains ≥ 30 Elo from a single match, which
// requires the loser to have been roughly 470+ Elo above the winner. Both
// players must be ranked at the time of the match.

describe("David Achievement", () => {
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

  // Build a setup where Goliath plays `opponentCount` fresh opponents and
  // wins every match — pushing Goliath's Elo high while every opponent
  // stays at ~1000 (one game each).
  const buildGoliath = (opponentCount: number): EventType[] => {
    const events: EventType[] = [createPlayer("goliath", 1)];
    for (let i = 0; i < opponentCount; i++) {
      events.push(createPlayer(`gopp-${i}`, 10 + i));
    }
    for (let i = 0; i < opponentCount; i++) {
      events.push(game(`gg-${i}`, 1000 + i, "goliath", `gopp-${i}`));
    }
    return events;
  };

  it("awards David when the winner gains ≥30 Elo from a single match", () => {
    // Goliath beats 200 fresh opponents → Elo well above 1500.
    // David beats 5 fresh opponents → ranked at Elo ~1073.
    // David then beats Goliath — the upset yields a ≥30 Elo swing.
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("david", 5000),
    ];
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`dopp-${i}`, 5010 + i));
    }
    for (let i = 0; i < 5; i++) {
      events.push(game(`dg-${i}`, 6000 + i, "david", `dopp-${i}`));
    }
    events.push(game("upset", 10000, "david", "goliath"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const davids = tt.achievements.getAchievements("david").filter((a) => a.type === "david");
    expect(davids).toHaveLength(1);
    expect(davids[0].data).toMatchObject({ opponent: "goliath", gameId: "upset" });
    expect(davids[0].data?.eloGain).toBeGreaterThanOrEqual(30);
  });

  it("does NOT fire for a typical match with similar-rated players", () => {
    // Standard 5-player double round-robin — Elos stay within ~200 of
    // each other so no swing reaches 30.
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

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(tt.achievements.getAchievements(id).filter((a) => a.type === "david")).toHaveLength(0);
    }
  });

  it("tracks the player's highest Elo gain in progression", () => {
    // After the David upset, progression.david.current should equal the
    // Elo gain of the upset (the player's all-time best win-gain).
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("david", 5000),
    ];
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`dopp-${i}`, 5010 + i));
    }
    for (let i = 0; i < 5; i++) {
      events.push(game(`dg-${i}`, 6000 + i, "david", `dopp-${i}`));
    }
    events.push(game("upset", 10000, "david", "goliath"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();
    const progression = tt.achievements.getPlayerProgression("david");

    expect(progression.david.target).toBe(30);
    expect(progression.david.earned).toBe(1);
    expect(progression.david.current).toBeGreaterThanOrEqual(30);
    // The progression value should equal the Elo gain stored on the badge.
    const badge = tt.achievements.getAchievements("david").find((a) => a.type === "david");
    expect(progression.david.current).toBe(badge?.data?.eloGain);
  });

  it("progression current is 0 when the player has no wins", () => {
    const events: EventType[] = [
      createPlayer("alice", 1),
      createPlayer("bob", 2),
      game("g1", 100, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("alice").david.current).toBe(0);
    expect(tt.achievements.getPlayerProgression("alice").david.earned).toBe(0);
  });

  it("does NOT fire when the winner is unranked", () => {
    // Goliath is ranked at very high Elo. Alice plays her first ever
    // game and beats Goliath. Even though Alice's Elo gain crosses 30,
    // she is unranked (tg=1) so the achievement is denied.
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("alice", 5000),
      game("upset", 10000, "alice", "goliath"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "david")).toHaveLength(0);
  });
});
