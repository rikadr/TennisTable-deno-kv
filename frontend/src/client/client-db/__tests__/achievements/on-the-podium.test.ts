import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("On the Podium Achievement", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // 5-player double round-robin (20 games). After playback every player
  // has 8 games (ranked) and standings are A=1, B=2, C=3, D=4, E=5. All
  // 5 ranked from time 113 onward.
  const fivePlayerSetup = (): EventType[] => {
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
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

  it("awards the achievement to ranked players in top 3 with ≥5 ranked", () => {
    const tt = new TennisTable({ events: fivePlayerSetup() });
    tt.achievements.calculateAchievements();

    // A first lands in top 3 at game 113 (final ranked player crosses
    // the threshold). B and C are awarded on game 114 (B as winner, C as
    // loser who is still rank #3 post-match).
    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    // D and E never end in top 3 — no podium.
    expect(tt.achievements.getAchievements("d").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award when fewer than 5 players are ranked", () => {
    // 4-player double round-robin (12 games). All 4 ranked but
    // rankedCount = 4 < 5, so no badge is awarded.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
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

    for (const id of ["a", "b", "c", "d"]) {
      expect(tt.achievements.getAchievements(id).filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    }
  });

  it("does NOT award on the very match where a player first becomes ranked", () => {
    // After the 20-game setup all 5 are ranked. F joins and beats E five
    // times. On F's 5th game F crosses the threshold and lands in top 3
    // (above B/C/D/E by Elo), but F was unranked entering this match, so
    // no podium is awarded.
    const events: EventType[] = [
      ...fivePlayerSetup(),
      { time: 6, stream: "f", type: EventTypeEnum.PLAYER_CREATED, data: { name: "F" } },
      game("fe-1", 200, "f", "e"),
      game("fe-2", 201, "f", "e"),
      game("fe-3", 202, "f", "e"),
      game("fe-4", 203, "f", "e"),
      game("fe-5", 204, "f", "e"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("f").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award at the very beginning when no player is yet ranked", () => {
    // First round-robin of the 5-player setup only (10 games). Each
    // player has just 4 games — nobody is ranked yet.
    const events = fivePlayerSetup().slice(0, 5 + 10);
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(tt.achievements.getAchievements(id).filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    }
  });

  it("is only awarded once per player", () => {
    // After the setup A/B/C have podium. Adding more games where they
    // stay in top 3 does not produce extra badges.
    const events = [
      ...fivePlayerSetup(),
      game("more-1", 200, "b", "d"),
      game("more-2", 201, "c", "d"),
      game("more-3", 202, "a", "b"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
  });

  it("is NOT awarded to an unranked player even if they have the highest Elo", () => {
    // Alice (one win) has the highest Elo but only 1 game — not ranked.
    const events: EventType[] = [
      { time: 1, stream: "alice", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "bob", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      game("g1", 100, "alice", "bob"),
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
  });

  it("promotes a non-participant to top 3 when the loser of a game drops out", () => {
    // 6-player double round-robin: A=1, B=2, C=3, D=4, E=5, F=6. After
    // the setup A, B and C have earned podium; D has not. Then F (the
    // weakest) upsets C three times — C's Elo drops below D's, so D is
    // now rank 3 even though D never played in those upsets. With the
    // per-game recheck D should earn podium at the moment of the third
    // upset (the game that finally tips C below D).
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
      { time: 6, stream: "f", type: EventTypeEnum.PLAYER_CREATED, data: { name: "F" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"], ["a", "f"],
      ["b", "c"], ["b", "d"], ["b", "e"], ["b", "f"],
      ["c", "d"], ["c", "e"], ["c", "f"],
      ["d", "e"], ["d", "f"],
      ["e", "f"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    // F upsets C three times.
    events.push(game("upset-1", 1000, "f", "c"));
    events.push(game("upset-2", 1001, "f", "c"));
    events.push(game("upset-3", 1002, "f", "c"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const dPodium = tt.achievements.getAchievements("d").filter((x) => x.type === "on-the-podium");
    expect(dPodium).toHaveLength(1);
    expect(dPodium[0].earnedAt).toBe(1002);
    // A, B and C already had podium before the upset.
    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    // E and F never reach top 3.
    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("f").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
  });

  it("promotes a player to top 3 when a top-3 player is deactivated", () => {
    // 6 players in a double round-robin (30 games). Standings:
    //   A=10W  rank 1,  B=8W 2L  rank 2,  C=6W 4L  rank 3,
    //   D=4W 6L rank 4,  E=2W 8L rank 5,  F=0W 10L rank 6.
    // A, B, C earn podium during the setup. C is then deactivated —
    // leaving 5 ranked active players and shifting D into rank 3. D
    // should earn the podium at the time of the deactivation event.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
      { time: 6, stream: "f", type: EventTypeEnum.PLAYER_CREATED, data: { name: "F" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"], ["a", "e"], ["a", "f"],
      ["b", "c"], ["b", "d"], ["b", "e"], ["b", "f"],
      ["c", "d"], ["c", "e"], ["c", "f"],
      ["d", "e"], ["d", "f"],
      ["e", "f"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    events.push({
      time: 1000,
      stream: "c",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    });

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    // A, B, C earned the podium during the setup.
    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("b").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((x) => x.type === "on-the-podium")).toHaveLength(1);
    // D was promoted to rank 3 by the deactivation and earns the badge.
    const dPodium = tt.achievements.getAchievements("d").filter((x) => x.type === "on-the-podium");
    expect(dPodium).toHaveLength(1);
    expect(dPodium[0].earnedAt).toBe(1000);
    // E and F never end in top 3.
    expect(tt.achievements.getAchievements("e").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("f").filter((x) => x.type === "on-the-podium")).toHaveLength(0);
  });

  it("excludes deactivated players from the ranked count", () => {
    // Same 5-player setup but E is deactivated before any games are
    // played. E has 8 games on the books but is not a ranked active
    // player, leaving only 4 ranked active. rankedCount = 4 < 5, so
    // nobody earns the badge.
    const deactivateE: EventType = {
      time: 50,
      stream: "e",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    };

    const tt = new TennisTable({ events: [...fivePlayerSetup(), deactivateE].sort((a, b) => a.time - b.time) });
    tt.achievements.calculateAchievements();

    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(tt.achievements.getAchievements(id).filter((x) => x.type === "on-the-podium")).toHaveLength(0);
    }
  });
});
