import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// David is the league record for the biggest single-game Elo gain. A gain of
// UPSET_RECORD_FLOOR (30 — requiring the loser to have been roughly 470+ Elo
// above the winner) establishes the first record; after that only a strictly
// bigger gain takes the record over and awards again. Both players must be
// ranked at the time of the match.

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

  it("awards David when a ≥30 Elo gain establishes the first league record", () => {
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
    // First league record — nothing to break yet.
    expect(davids[0].data?.previousRecord).toBeUndefined();
    expect(tt.achievements.davidRecord).toStrictEqual({
      eloGain: davids[0].data?.eloGain,
      holder: "david",
    });
  });

  it("does NOT award again for a swing that fails to beat the standing record", () => {
    // After the first upset the Elo gap between the pair has narrowed, so a
    // rematch win yields a strictly smaller gain — no new award.
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
    events.push(game("rematch", 10001, "david", "goliath"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const davids = tt.achievements.getAchievements("david").filter((a) => a.type === "david");
    expect(davids).toHaveLength(1);
    expect(davids[0].data?.gameId).toBe("upset");
  });

  it("awards again with previousRecord when a strictly bigger swing breaks the record", () => {
    // First record: david-1 (5 wins, ~1073) beats goliath-1 (200 wins).
    // Then david-2, in an identical position, beats goliath-2 who has 400
    // wins — a bigger Elo gap with the same K-factor, so a strictly bigger
    // gain that takes the record over.
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

    events.push(createPlayer("goliath-2", 20000));
    for (let i = 0; i < 400; i++) {
      events.push(createPlayer(`g2opp-${i}`, 20010 + i));
    }
    for (let i = 0; i < 400; i++) {
      events.push(game(`g2g-${i}`, 21000 + i, "goliath-2", `g2opp-${i}`));
    }
    events.push(createPlayer("david-2", 30000));
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`d2opp-${i}`, 30010 + i));
    }
    for (let i = 0; i < 5; i++) {
      events.push(game(`d2g-${i}`, 31000 + i, "david-2", `d2opp-${i}`));
    }
    events.push(game("upset-2", 40000, "david-2", "goliath-2"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const firstBadge = tt.achievements.getAchievements("david").find((a) => a.type === "david");
    const secondBadge = tt.achievements.getAchievements("david-2").find((a) => a.type === "david");
    expect(firstBadge).toBeDefined();
    expect(secondBadge).toBeDefined();
    expect(secondBadge?.data?.eloGain).toBeGreaterThan(firstBadge?.data?.eloGain ?? Infinity);
    expect(secondBadge?.data?.previousRecord).toBe(firstBadge?.data?.eloGain);
    expect(tt.achievements.davidRecord.holder).toBe("david-2");
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

    expect(progression.david.earned).toBe(1);
    expect(progression.david.current).toBeGreaterThanOrEqual(30);
    // The progression value should equal the Elo gain stored on the badge,
    // and the badge's gain is the league record to beat.
    const badge = tt.achievements.getAchievements("david").find((a) => a.type === "david");
    expect(progression.david.current).toBe(badge?.data?.eloGain);
    expect(progression.david.target).toBe(badge?.data?.eloGain);
    expect(progression.david.recordHolder).toBe("david");
  });

  it("progression has no target while nobody holds the record", () => {
    const events: EventType[] = [
      createPlayer("alice", 1),
      createPlayer("bob", 2),
      game("g1", 100, "bob", "alice"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("bob").david.target).toBeUndefined();
    expect(tt.achievements.getPlayerProgression("bob").david.recordHolder).toBeUndefined();
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

  it("progression is 0 for an unranked player (too few games)", () => {
    // Bob plays just 4 games against Carol → never ranked. He has wins
    // but no qualifying ones; progression must be 0.
    const events: EventType[] = [
      createPlayer("bob", 1),
      createPlayer("carol", 2),
    ];
    for (let i = 0; i < 4; i++) {
      events.push(game(`g${i}`, 100 + i, "bob", "carol"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("bob").david.current).toBe(0);
  });

  it("progression is retained for a deactivated player who had qualifying wins", () => {
    // David earns David during the setup, then is deactivated. The
    // qualifying game happened while he was active and ranked, so the
    // progression value persists past the deactivation.
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
      stream: "david",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    });

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("david").david.current).toBeGreaterThanOrEqual(30);
  });

  it("progression only counts wins where both players were ranked at the time", () => {
    // Goliath has 200 wins and is ranked. Alice plays Goliath in her
    // very first game and wins — Alice is unranked entering the match,
    // so the gain does not count toward Alice's David progression.
    const events: EventType[] = [
      ...buildGoliath(200),
      createPlayer("alice", 5000),
      game("upset", 10000, "alice", "goliath"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("alice").david.current).toBe(0);
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
