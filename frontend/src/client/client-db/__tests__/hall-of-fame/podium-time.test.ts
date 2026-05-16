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

    // The podium activates at t=113 (when E becomes ranked, all in day 0)
    // and runs until the ping at day 10 + tiny offset, so days [0..10] = 11.
    expect(a?.rank1Days).toBe(11);
    expect(a?.score).toBe(11);
    expect(b?.rank2Days).toBe(11);
    expect(b?.score).toBe(5.5);
    expect(c?.rank3Days).toBe(11);
    expect(c?.score).toBe(5.5);
    expect(d?.score).toBe(0);
    expect(e?.score).toBe(0);
  });

  it("freezes the podium clock when a deactivation drops the ranked count below 5", () => {
    const setup = fivePlayerSetup();
    const lastSetupTime = 119;
    // C retires 5 days after setup ends. After C is gone only 4 players
    // are ranked, so the podium clock should stop until the count is back
    // up to 5 (which never happens in this test).
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

    // Podium runs from t=113 (day 0) until C's retirement at day 5 + tiny,
    // so days [0..5] = 6 calendar days each at their respective ranks.
    expect(a?.rank1Days).toBe(6);
    expect(a?.score).toBe(6);
    expect(b?.rank2Days).toBe(6);
    expect(b?.score).toBe(3);
    expect(c?.rank3Days).toBe(6);
    expect(c?.score).toBe(3);
    // D never earns podium time — the ranked count drops to 4 the moment
    // C retires.
    expect(d?.score).toBe(0);
  });

  it("does not accumulate podium time until 5 players are ranked", () => {
    // Only A and B ever play. They cross the rank threshold but the league
    // has fewer than 5 ranked players, so no podium time is earned.
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
    expect(tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime.score).toBe(0);
    expect(tt.hallOfFame.getScoreForAnyPlayer("b")?.score.podiumTime.score).toBe(0);
  });

  it("does not credit podium time earned before the 5th player became ranked", () => {
    // A, B, C, D play a round-robin that ranks all 4 of them. Then a 10-day
    // gap with no games. E joins late and needs 5 games to become ranked.
    // Only after E is ranked (i.e. after game 5 of A-vs-E) should the
    // podium clock start.
    const events: EventType[] = [
      { time: 1, stream: "a", type: EventTypeEnum.PLAYER_CREATED, data: { name: "A" } },
      { time: 2, stream: "b", type: EventTypeEnum.PLAYER_CREATED, data: { name: "B" } },
      { time: 3, stream: "c", type: EventTypeEnum.PLAYER_CREATED, data: { name: "C" } },
      { time: 4, stream: "d", type: EventTypeEnum.PLAYER_CREATED, data: { name: "D" } },
      { time: 5, stream: "e", type: EventTypeEnum.PLAYER_CREATED, data: { name: "E" } },
    ];
    const pairs: [string, string][] = [
      ["a", "b"], ["a", "c"], ["a", "d"],
      ["b", "c"], ["b", "d"],
      ["c", "d"],
    ];
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of pairs) {
        events.push(game(`rr-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    // A 10-day idle stretch: A, B, C, D are all ranked but only 4 of them,
    // so no podium time should accrue.
    const idleGap = 10 * ONE_DAY;
    let tE = t + idleGap;
    // E plays 5 games against A to become ranked.
    for (let i = 0; i < 5; i++) {
      events.push(game(`e-${i}`, tE++, "a", "e"));
    }
    // Ping the clock 10 days after E is ranked.
    events.push(game("ping", tE + 10 * ONE_DAY, "a", "b"));

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    // Podium starts at day 10 (when E becomes ranked) and runs to day 20
    // + tiny (the ping) = days [10..20] = 11 calendar days at rank 1.
    // No credit for the 10-day idle stretch where only 4 players ranked.
    expect(a?.rank1Days).toBe(11);
  });

  it("re-opens the podium when a deactivated player is brought back", () => {
    // After the 5-player setup, all 5 are ranked and A,B,C are on the podium.
    // C retires after 5 days, dropping the ranked count to 4 and freezing
    // the podium. 5 days later C is reactivated, restoring 5 ranked players
    // and re-opening the podium. Another 5 days pass before a ping.
    const setup = fivePlayerSetup();
    const lastSetupTime = 119;
    const retireTime = lastSetupTime + 5 * ONE_DAY;
    const reactivateTime = lastSetupTime + 10 * ONE_DAY;
    const futureTime = lastSetupTime + 15 * ONE_DAY;
    const events: EventType[] = [
      ...setup,
      { time: retireTime, stream: "c", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
      { time: reactivateTime, stream: "c", type: EventTypeEnum.PLAYER_REACTIVATED, data: null },
      game("ping", futureTime, "a", "d"),
    ];

    const tt = new TennisTable({ events });
    const a = tt.hallOfFame.getScoreForAnyPlayer("a")?.score.podiumTime;
    const c = tt.hallOfFame.getScoreForAnyPlayer("c")?.score.podiumTime;

    // A is on the podium across days [0..5] (before retire) and
    // [10..15] (after reactivate) = 12 unique days.
    expect(a?.rank1Days).toBe(12);
    // C is back at #3 across days [10..15] after reactivation = 6 days,
    // plus the 6 days [0..5] before retirement = 12 unique days.
    expect(c?.rank3Days).toBe(12);
  });
});
