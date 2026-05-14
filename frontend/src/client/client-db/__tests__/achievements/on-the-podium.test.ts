import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

describe("On the Podium Achievement", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Dave" } },
    ];
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // Double round-robin among a, b, c, d (12 games). After playback every
  // player has 6 games (ranked) and the standings are:
  //   a = 6W       → rank 1
  //   b = 4W 2L    → rank 2
  //   c = 2W 4L    → rank 3
  //   d = 0W 6L    → rank 4
  const fourPlayerSetup = (startTime = 100): EventType[] => {
    const events: EventType[] = [];
    const pairs: [string, string][] = [
      ["a", "b"],
      ["a", "c"],
      ["a", "d"],
      ["b", "c"],
      ["b", "d"],
      ["c", "d"],
    ];
    let t = startTime;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    return events;
  };

  it("awards the achievement when a ranked player ends up in top 3 with ≥4 ranked", () => {
    // After 12 games the standings are a=1, b=2, c=3, d=4. The earliest
    // matches where a player is both pre-match ranked and post-match in
    // top 3 with rankedCount ≥ 4 are game 11 (Bob's 6th, post-match makes
    // it 4 ranked) and game 12 (Carol's 6th).
    const tt = new TennisTable({ events: [...baseEvents, ...fourPlayerSetup()] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
    // Alice's last match was game 9, before all 4 were ranked — she
    // doesn't earn the badge in this setup. Dave never lands in top 3.
    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("d").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award when only 3 players are ranked", () => {
    // 3 players play a triple round-robin (9 games). All three end ranked
    // with tg=6 and a clear ordering, but the achievement requires at
    // least 4 ranked active players so nobody earns it.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Carol" } },
    ];
    let t = 100;
    for (let round = 0; round < 3; round++) {
      events.push(game(`r${round}-ab`, t++, "a", "b"));
      events.push(game(`r${round}-ac`, t++, "a", "c"));
      events.push(game(`r${round}-bc`, t++, "b", "c"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award on the very match where a player first becomes ranked", () => {
    // 4 players, double round-robin (12 games). Even though the 11th and
    // 12th matches bring players over the 5-game threshold, the player
    // hitting their 5th game in this match wasn't pre-match ranked and so
    // doesn't get the badge — Bob/Carol get it on their 6th game instead.
    // This test stops at game 10, where only A and B are ranked entering
    // the match.
    const events = [...baseEvents, ...fourPlayerSetup().slice(0, 10)];
    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("d").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("does NOT award at the very beginning when no player is yet ranked", () => {
    // First round-robin only (6 games). No player has hit the 5-game
    // threshold; nobody is ranked.
    const events = [...baseEvents, ...fourPlayerSetup().slice(0, 6)];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("d").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("is only awarded once per player", () => {
    // Run the full 12-game setup and then add 6 more matches that keep
    // Bob/Carol in top 3. Each should still only have one badge.
    const extra: EventType[] = [];
    let t = 1000;
    for (let i = 0; i < 3; i++) {
      extra.push(game(`extra-b-${i}`, t++, "b", "d"));
      extra.push(game(`extra-c-${i}`, t++, "c", "d"));
    }
    const tt = new TennisTable({ events: [...baseEvents, ...fourPlayerSetup(), ...extra] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(1);
  });

  it("is NOT awarded to an unranked player even if they have the highest Elo", () => {
    // Alice (one win) has the highest Elo but only 1 game — not ranked.
    const events: EventType[] = [...baseEvents, game("g1", 100, "a", "b")];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });

  it("excludes deactivated players from the ranked count", () => {
    // Same 4-player setup, but Dave is deactivated before any games are
    // played. He has 6 games on the books but is not a ranked-active
    // player, leaving only 3 ranked active (a, b, c). The 4-ranked
    // requirement isn't met, so nobody earns the badge.
    const deactivateDave: EventType = {
      time: 50,
      stream: "d",
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      data: null,
    };

    const tt = new TennisTable({ events: [...baseEvents, deactivateDave, ...fourPlayerSetup()] });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("b").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("c").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
    expect(tt.achievements.getAchievements("d").filter((a) => a.type === "on-the-podium")).toHaveLength(0);
  });
});
