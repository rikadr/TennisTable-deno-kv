import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

const ONE_DAY = 24 * 60 * 60 * 1000;

describe("Hall of Fame podium time", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // 5-player double round-robin (20 games). Times 100..119. All 5 ranked
  // (gameLimitForRanked = 5) with final standings A=1, B=2, C=3, D=4, E=5.
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

  it("gives no podium time when no player is yet ranked", () => {
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      game("g1", 100, "a", "b"),
      game("g2", 100 + 30 * ONE_DAY, "a", "b"),
    ];

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    expect(a?.score).toBe(0);
    expect(a?.rank1Days).toBe(0);
    expect(a?.rank2Days).toBe(0);
    expect(a?.rank3Days).toBe(0);
  });

  it("scores 1 pt per day at #1, 0.5 pt per day at #2 and #3", () => {
    const setup = fivePlayerSetup();
    const lastSetupTime = 119; // last game time in the round-robin
    const futureTime = lastSetupTime + 10 * ONE_DAY;
    // A pings-the-clock game between D and E far in the future. This
    // doesn't change the top 3 (A, B, C) but advances time by 10 days.
    const events = [...setup, game("ping", futureTime, "d", "e")];

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    const b = tt.hallOfFame.getScoreForAnyPlayer("b")?.score.podiumTime;
    const c = tt.hallOfFame.getScoreForAnyPlayer("c")?.score.podiumTime;
    const d = tt.hallOfFame.getScoreForAnyPlayer("d")?.score.podiumTime;
    const e = tt.hallOfFame.getScoreForAnyPlayer("e")?.score.podiumTime;

    expect(a?.rank1Days).toBe(10);
    expect(a?.score).toBe(10);
    expect(b?.rank2Days).toBe(10);
    expect(b?.score).toBe(5);
    expect(c?.rank3Days).toBe(10);
    expect(c?.score).toBe(5);
    expect(d?.score).toBe(0);
    expect(e?.score).toBe(0);
  });

  it("stops accumulating podium time after a top-3 player is deactivated", () => {
    const setup = fivePlayerSetup();
    const lastSetupTime = 119;
    // C retires 5 days after setup ends. Next game is 15 days after setup.
    const retireTime = lastSetupTime + 5 * ONE_DAY;
    const futureTime = lastSetupTime + 15 * ONE_DAY;
    const events: EventType[] = [
      ...setup,
      { time: retireTime, stream: "c", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
      game("ping", futureTime, "a", "d"),
    ];

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    const b = tt.hallOfFame.getScoreForAnyPlayer("b")?.score.podiumTime;
    const c = tt.hallOfFame.getScoreForAnyPlayer("c")?.score.podiumTime;
    const d = tt.hallOfFame.getScoreForAnyPlayer("d")?.score.podiumTime;

    // A stays at #1 the whole time: 15 days.
    expect(a?.rank1Days).toBe(15);
    expect(a?.score).toBe(15);
    // B stays at #2 the whole time: 15 days at 0.5 = 7.5.
    expect(b?.rank2Days).toBe(15);
    expect(b?.score).toBe(7.5);
    // C is at #3 for 5 days before retiring.
    expect(c?.rank3Days).toBe(5);
    expect(c?.score).toBe(2.5);
    // D gets promoted to #3 by C's retirement and holds it for 10 days.
    expect(d?.rank3Days).toBe(10);
    expect(d?.score).toBe(5);
  });

  it("treats top 3 by position regardless of how many players are ranked", () => {
    // Only A and B ever play, A always wins. After 5 games both are ranked.
    // They are the entire podium (A at #1, B at #2). After 10 days a ping
    // game ticks the clock.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
    ];
    for (let i = 0; i < 5; i++) {
      events.push(game(`g${i}`, 100 + i, "a", "b"));
    }
    const lastTime = 104;
    events.push(game("ping", lastTime + 10 * ONE_DAY, "a", "b"));

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    const b = tt.hallOfFame.getScoreForAnyPlayer("b")?.score.podiumTime;

    expect(a?.rank1Days).toBe(10);
    expect(a?.score).toBe(10);
    expect(b?.rank2Days).toBe(10);
    expect(b?.score).toBe(5);
  });
});
