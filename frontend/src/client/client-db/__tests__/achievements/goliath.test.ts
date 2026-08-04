import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Goliath is the league record for the biggest single-game Elo loss. A loss
// of UPSET_RECORD_FLOOR (20 — requiring the winner to have been roughly 90+
// Elo below the loser) establishes the first record; after that only a
// strictly bigger loss takes the record over and awards again. Both players
// must be ranked at the time of the match. It is the mirror of David — the
// game that sets the David record sets the Goliath record too. The fixtures
// here produce ≥30-point swings, comfortably past the floor.

describe("Goliath Achievement", () => {
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

  it("awards Goliath when a loss past the record floor establishes the first league record", () => {
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

    const goliaths = tt.achievements.getAchievements("goliath").filter((a) => a.type === "goliath");
    expect(goliaths).toHaveLength(1);
    expect(goliaths[0].data).toMatchObject({ opponent: "david", gameId: "upset" });
    expect(goliaths[0].data?.eloLoss).toBeGreaterThanOrEqual(30);
    // First league record — nothing to break yet.
    expect(goliaths[0].data?.previousRecord).toBeUndefined();
    expect(tt.achievements.goliathRecord).toStrictEqual({
      eloLoss: goliaths[0].data?.eloLoss,
      holder: "goliath",
    });
  });

  it("does NOT fire for a typical match with similar-rated players", () => {
    // Standard 5-player double round-robin where the stronger player always
    // wins — every loss is at most the evenly-matched 16 points, under the
    // 20-point record floor.
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
      expect(tt.achievements.getAchievements(id).filter((a) => a.type === "goliath")).toHaveLength(0);
    }
  });

  it("tracks the player's largest Elo loss in progression", () => {
    // After the upset, progression.goliath.current for the losing
    // Goliath should equal the Elo lost in that match (their all-time
    // worst single-match loss).
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
    const progression = tt.achievements.getPlayerProgression("goliath");

    expect(progression.goliath.earned).toBe(1);
    expect(progression.goliath.current).toBeGreaterThanOrEqual(30);
    // The progression value should equal the Elo loss stored on the badge,
    // and the badge's loss is the league record to beat.
    const badge = tt.achievements.getAchievements("goliath").find((a) => a.type === "goliath");
    expect(progression.goliath.current).toBe(badge?.data?.eloLoss);
    expect(progression.goliath.target).toBe(badge?.data?.eloLoss);
    expect(progression.goliath.recordHolder).toBe("goliath");
  });

  it("progression current is 0 when the player has no losses", () => {
    const events: EventType[] = [
      createPlayer("alice", 1),
      createPlayer("bob", 2),
      game("g1", 100, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("bob").goliath.current).toBe(0);
    expect(tt.achievements.getPlayerProgression("bob").goliath.earned).toBe(0);
  });

  it("progression is 0 for an unranked player (too few games)", () => {
    // Bob plays just 4 games against Carol → never ranked. He has
    // losses but no qualifying ones; progression must be 0.
    const events: EventType[] = [
      createPlayer("bob", 1),
      createPlayer("carol", 2),
    ];
    for (let i = 0; i < 4; i++) {
      events.push(game(`g${i}`, 100 + i, "carol", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("bob").goliath.current).toBe(0);
  });

  it("progression is retained for a deactivated player who had qualifying losses", () => {
    // Goliath suffers the upset during the setup, then is deactivated.
    // The qualifying game happened while he was active and ranked, so
    // the progression value persists past the deactivation.
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
    events.push({
      time: 20000,
      stream: "goliath",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    });

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("goliath").goliath.current).toBeGreaterThanOrEqual(30);
  });

  it("progression only counts losses where both players were ranked at the time", () => {
    // Goliath has 200 wins and is ranked. Alice plays Goliath in her
    // very first game and wins — Alice is unranked entering the match,
    // so the loss does not count toward Goliath's progression either.
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("alice", 5000),
      game("upset", 10000, "alice", "goliath"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("goliath").goliath.current).toBe(0);
  });

  it("does NOT fire when the loser is unranked", () => {
    // Carol plays only 3 games — never crosses the ranked threshold —
    // and one of them is a loss to a much higher-rated player. Even if
    // the Elo swing were large, Carol isn't ranked at the time so
    // Goliath should not fire.
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("carol", 5000),
      game("c1", 10000, "carol", "goliath"),
      game("c2", 10001, "carol", "goliath"),
      game("c3", 10002, "goliath", "carol"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("carol").filter((a) => a.type === "goliath")).toHaveLength(0);
  });

  it("fires alongside David on the same game (both players awarded)", () => {
    // Mirror sanity check: when David is earned by the winner, Goliath
    // must be earned by the loser of the same game.
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

    const david = tt.achievements.getAchievements("david").find((a) => a.type === "david");
    const goliath = tt.achievements.getAchievements("goliath").find((a) => a.type === "goliath");

    expect(david).toBeDefined();
    expect(goliath).toBeDefined();
    expect(david?.data?.gameId).toBe("upset");
    expect(goliath?.data?.gameId).toBe("upset");
    // The Elo swing recorded on each side must match (zero-sum).
    expect(goliath?.data?.eloLoss).toBe(david?.data?.eloGain);
  });
});
