import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Everybody's Opponent: play every currently ranked player at least once —
// wins and losses both count. Same cohort semantics as Full House / Humbled:
// the target is the ranked cohort at the moment of the check, ≥5 ranked
// players required, and the earner does not need to be ranked themselves.
// Default GuestClient has gameLimitForRanked = 5.

describe("Everybody's Opponent Achievement", () => {
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
  // (all ranked) and has played every other player.
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

  it("awards every player of a full round-robin — losses count as much as wins", () => {
    const events = fivePlayerSetup();
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // A wins everything, E loses everything — both have played everyone.
    for (const playerId of ["a", "b", "c", "d", "e"]) {
      const awards = tt.achievements.getAchievements(playerId).filter((x) => x.type === "everybodys-opponent");
      expect(awards).toHaveLength(1);
      expect(awards[0].data.count).toBe(4);
    }
  });

  it("does NOT award a ranked player who has not played everyone", () => {
    // F becomes ranked through 5 games against A alone. F has never played
    // B, C, D or E — no award for F.
    const events = [...fivePlayerSetup(), createPlayer("f", 500)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`f-${i}`, 1000 + i, "a", "f"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("f").filter((x) => x.type === "everybodys-opponent")).toHaveLength(0);
    // The awards earned while the cohort was A–E stay earned.
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "everybodys-opponent")).toHaveLength(1);
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
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

    for (const playerId of ["a", "b", "c", "d"]) {
      expect(tt.achievements.getAchievements(playerId).filter((x) => x.type === "everybodys-opponent")).toHaveLength(0);
    }
  });

  it("completes through a deactivation when the missing opponent leaves the cohort", () => {
    // F plays 5 early games against B (both become ranked). The round-robin
    // then ranks A–E, making the cohort A–F — and only B has ever played F.
    // Deactivating F shrinks the cohort back to A–E, completing the set for
    // A, C, D and E on the spot.
    const events: EventType[] = [
      createPlayer("a", 1),
      createPlayer("b", 2),
      createPlayer("c", 3),
      createPlayer("d", 4),
      createPlayer("e", 5),
      createPlayer("f", 6),
    ];
    for (let i = 0; i < 5; i++) {
      events.push(game(`f-${i}`, 10 + i, "b", "f"));
    }
    events.push(...fivePlayerSetup().filter((e) => e.type === EventTypeEnum.GAME_CREATED));
    const deactivationTime = 5000;
    events.push(deactivate("f", deactivationTime));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const aAwards = tt.achievements.getAchievements("a").filter((x) => x.type === "everybodys-opponent");
    expect(aAwards).toHaveLength(1);
    expect(aAwards[0].earnedAt).toBe(deactivationTime);
    // B played F directly and completed already during the round-robin.
    const bAwards = tt.achievements.getAchievements("b").filter((x) => x.type === "everybodys-opponent");
    expect(bAwards).toHaveLength(1);
    expect(bAwards[0].earnedAt).toBeLessThan(deactivationTime);
  });

  it("tracks progression with the players still to play", () => {
    // F is ranked but has only ever played A.
    const events = [...fivePlayerSetup(), createPlayer("f", 500)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`f-${i}`, 1000 + i, "a", "f"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const fProgress = tt.achievements.getPlayerProgression("f");
    expect(fProgress["everybodys-opponent"].current).toBe(1);
    expect(fProgress["everybodys-opponent"].target).toBe(5);
    expect(Array.from(fProgress["everybodys-opponent"].missing!).sort()).toEqual(["b", "c", "d", "e"]);
    expect(fProgress["everybodys-opponent"].earned).toBe(0);

    // A has played everyone, F included.
    const aProgress = tt.achievements.getPlayerProgression("a");
    expect(aProgress["everybodys-opponent"].current).toBe(5);
    expect(aProgress["everybodys-opponent"].target).toBe(5);
    expect(aProgress["everybodys-opponent"].missing!.size).toBe(0);
    expect(aProgress["everybodys-opponent"].earned).toBe(1);
  });
});
