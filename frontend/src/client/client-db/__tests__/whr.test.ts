import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { GAME_LEVEL_ONLY, POINT_SLOPE, SET_SLOPE, WhrConfig, WhrResult } from "../whr";

const DAY_MS = 24 * 60 * 60 * 1000;

let sequence = 0;
const nextSequence = () => ++sequence;

function player(id: string): EventType {
  return { time: nextSequence(), stream: id, type: EventTypeEnum.PLAYER_CREATED, data: { name: id } };
}

function deactivate(id: string): EventType {
  return { time: nextSequence(), stream: id, type: EventTypeEnum.PLAYER_DEACTIVATED, data: null };
}

/** One game on a given day. The day decides which rating point the game lands on. */
function game(winner: string, loser: string, day = 0): EventType {
  const playedAt = day * DAY_MS + nextSequence();
  return {
    time: playedAt,
    stream: `game-${winner}-${loser}-${playedAt}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  };
}

/** A game with a set score, and the points of each set. */
function scoredGame(
  winner: string,
  loser: string,
  setPoints: { gameWinner: number; gameLoser: number }[],
  day = 0,
): EventType[] {
  const playedAt = day * DAY_MS + nextSequence();
  const stream = `game-${playedAt}`;
  return [
    { time: playedAt, stream, type: EventTypeEnum.GAME_CREATED, data: { playedAt, winner, loser } },
    {
      time: playedAt + 1,
      stream,
      type: EventTypeEnum.GAME_SCORE,
      data: {
        setsWon: {
          gameWinner: setPoints.filter((set) => set.gameWinner > set.gameLoser).length,
          gameLoser: setPoints.filter((set) => set.gameLoser > set.gameWinner).length,
        },
        setPoints,
      },
    },
  ];
}

function games(winner: string, loser: string, count: number, day = 0): EventType[] {
  return Array.from({ length: count }, () => game(winner, loser, day));
}

/** mulberry32, so a generated set of results is the same on every run. */
function makeRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function compute(events: EventType[], options?: Partial<WhrConfig>): WhrResult {
  return new TennisTable({ events }).whr.compute(options);
}

function curve(result: WhrResult, playerId: string) {
  const found = result.curves.find((c) => c.playerId === playerId);
  if (!found) throw new Error(`No curve for ${playerId}`);
  return found;
}

function lastRating(result: WhrResult, playerId: string): number {
  const points = curve(result, playerId).points;
  return points[points.length - 1].rating;
}

describe("Whr", () => {
  beforeEach(() => {
    sequence = 0;
  });

  it("rates an even record at the rating of a new player", () => {
    const result = compute([player("a"), player("b"), ...games("a", "b", 5), ...games("b", "a", 5)]);

    expect(lastRating(result, "a")).toBeCloseTo(1000, 3);
    expect(lastRating(result, "b")).toBeCloseTo(1000, 3);
    expect(result.converged).toBe(true);
  });

  it("rates the player who wins more above the other", () => {
    const result = compute([player("a"), player("b"), ...games("a", "b", 8), ...games("b", "a", 2)]);

    const a = lastRating(result, "a");
    const b = lastRating(result, "b");

    expect(a).toBeGreaterThan(b);
    // With one pairing and a symmetric prior the two ratings sit either side of the
    // anchor. The fit stops at a tolerance, so allow a fraction of a point.
    expect(Math.abs(a + b - 2000)).toBeLessThan(0.5);
  });

  it("does not change any curve when a player retires", () => {
    const history = [
      player("a"),
      player("b"),
      player("c"),
      ...games("a", "b", 4, 0),
      ...games("b", "c", 3, 1),
      ...games("c", "a", 2, 2),
      ...games("a", "c", 3, 3),
    ];

    const before = compute(history);
    const after = compute([...history, deactivate("b")]);

    expect(after.curves.length).toBe(before.curves.length);
    for (const playerId of ["a", "b", "c"]) {
      const pointsBefore = curve(before, playerId).points;
      const pointsAfter = curve(after, playerId).points;
      expect(pointsAfter.length).toBe(pointsBefore.length);
      pointsBefore.forEach((point, index) => {
        expect(pointsAfter[index].time).toBe(point.time);
        expect(pointsAfter[index].rating).toBeCloseTo(point.rating, 10);
        expect(pointsAfter[index].uncertainty).toBeCloseTo(point.uncertainty, 10);
      });
    }
  });

  it("still rates a retired player", () => {
    const result = compute([
      player("a"),
      player("b"),
      ...games("a", "b", 5),
      ...games("b", "a", 1),
      deactivate("b"),
    ]);

    expect(result.curves.map((c) => c.playerId).sort()).toEqual(["a", "b"]);
    expect(lastRating(result, "a")).toBeGreaterThan(lastRating(result, "b"));
  });

  it("orders players through a chain of opponents they never played", () => {
    // 'a' and 'c' never meet. Only the games against 'b' connect them.
    const result = compute([
      player("a"),
      player("b"),
      player("c"),
      ...games("a", "b", 8),
      ...games("b", "a", 2),
      ...games("b", "c", 8),
      ...games("c", "b", 2),
    ]);

    expect(lastRating(result, "a")).toBeGreaterThan(lastRating(result, "b"));
    expect(lastRating(result, "b")).toBeGreaterThan(lastRating(result, "c"));
  });

  it("gives one rating point per day a player played", () => {
    const result = compute([
      player("a"),
      player("b"),
      ...games("a", "b", 2, 0),
      ...games("b", "a", 1, 1),
      ...games("a", "b", 1, 5),
    ]);

    const points = curve(result, "a").points;
    expect(points.map((p) => p.time)).toEqual([0, DAY_MS, 5 * DAY_MS]);
    expect(points.map((p) => p.games)).toEqual([2, 1, 1]);
    expect(curve(result, "a").totalGames).toBe(4);
  });

  it("narrows the uncertainty as a player plays more games", () => {
    const few = compute([player("a"), player("b"), ...games("a", "b", 1), ...games("b", "a", 1)]);
    const many = compute([player("a"), player("b"), ...games("a", "b", 20), ...games("b", "a", 20)]);

    const fewUncertainty = curve(few, "a").points[0].uncertainty;
    const manyUncertainty = curve(many, "a").points[0].uncertainty;

    expect(manyUncertainty).toBeLessThan(fewUncertainty);
    expect(manyUncertainty).toBeGreaterThan(0);
  });

  it("follows a player whose results improve over time", () => {
    const events: EventType[] = [player("a"), player("b")];
    for (let day = 0; day < 10; day++) {
      events.push(...games("b", "a", 2, day));
    }
    for (let day = 90; day < 100; day++) {
      events.push(...games("a", "b", 2, day));
    }

    const result = compute(events, { driftPerDay: 25 });
    const points = curve(result, "a").points;
    const first = points[0].rating;
    const last = points[points.length - 1].rating;

    expect(last).toBeGreaterThan(first + 100);
    // The same games, so the two curves mirror each other around the anchor
    const opponent = curve(result, "b").points;
    expect(Math.abs(last + opponent[opponent.length - 1].rating - 2000)).toBeLessThan(0.5);
  });

  it("keeps a rating flat when the results stay the same over time", () => {
    const events: EventType[] = [player("a"), player("b")];
    for (let day = 0; day < 20; day += 2) {
      events.push(...games("a", "b", 3, day), ...games("b", "a", 1, day));
    }

    const points = curve(compute(events), "a").points;
    const ratings = points.map((p) => p.rating);
    const spread = Math.max(...ratings) - Math.min(...ratings);

    expect(spread).toBeLessThan(15);
    expect(ratings[0]).toBeGreaterThan(1000);
  });

  it("rates a player who has only played one game", () => {
    const result = compute([player("a"), player("b"), game("a", "b")]);

    expect(curve(result, "a").totalGames).toBe(1);
    expect(lastRating(result, "a")).toBeGreaterThan(1000);
    expect(lastRating(result, "b")).toBeLessThan(1000);
  });

  it("returns no curves when there are no games", () => {
    const result = compute([player("a"), player("b")]);

    expect(result.curves).toEqual([]);
    expect(result.converged).toBe(true);
  });

  it("moves a rating further from the anchor when the prior is weaker", () => {
    const events = [player("a"), player("b"), ...games("a", "b", 6), ...games("b", "a", 1)];

    const tight = compute(events, { newPlayerUncertainty: 50 });
    const loose = compute(events, { newPlayerUncertainty: 600 });

    expect(lastRating(loose, "a")).toBeGreaterThan(lastRating(tight, "a"));
  });

  it("recovers the order of players with known strengths", () => {
    // Every pair plays 60 games, drawn from the Elo win chance of their true
    // ratings. All games are on one day, so only the ranking is under test.
    const trueRating: Record<string, number> = { e: 700, d: 820, c: 940, b: 1060, a: 1180, s: 1300 };
    const ids = Object.keys(trueRating);
    const random = makeRandom(7);

    const events: EventType[] = ids.map((id) => player(id));
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [one, two] = [ids[i], ids[j]];
        const chance = 1 / (1 + Math.pow(10, (trueRating[two] - trueRating[one]) / 400));
        for (let round = 0; round < 60; round++) {
          const oneWins = random() < chance;
          events.push(game(oneWins ? one : two, oneWins ? two : one));
        }
      }
    }

    const result = compute(events);
    const fitted = result.curves
      .map((curve) => ({ id: curve.playerId, rating: curve.points[curve.points.length - 1].rating }))
      .sort((a, b) => b.rating - a.rating);

    const trueOrder = ids.slice().sort((one, two) => trueRating[two] - trueRating[one]);
    expect(fitted.map((entry) => entry.id)).toEqual(trueOrder);
    expect(result.converged).toBe(true);
    expect(fitted[0].rating).toBeGreaterThan(1000);
    expect(fitted[fitted.length - 1].rating).toBeLessThan(1000);
  });

  describe("set and point scores", () => {
    const crushing = [
      { gameWinner: 11, gameLoser: 2 },
      { gameWinner: 11, gameLoser: 1 },
    ];
    const narrow = [
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 12, gameLoser: 10 },
    ];

    /** Two separate pairings, each with the same game record, so only the margin differs. */
    function twoLeagues(options?: Partial<WhrConfig>) {
      const dominant: EventType[] = [player("a"), player("b")];
      const even: EventType[] = [player("c"), player("d")];
      for (let day = 0; day < 5; day++) {
        dominant.push(...scoredGame("a", "b", crushing, day));
        even.push(...scoredGame("c", "d", narrow, day));
      }
      return {
        dominant: lastRating(compute(dominant, options), "a"),
        even: lastRating(compute(even, options), "c"),
      };
    }

    it("rates a win by a large margin above a win by a small margin", () => {
      const { dominant, even } = twoLeagues();

      expect(dominant).toBeGreaterThan(even + 100);
    });

    it("ignores the margin when the score levels are switched off", () => {
      const { dominant, even } = twoLeagues({ levelWeights: GAME_LEVEL_ONLY });

      expect(dominant).toBeCloseTo(even, 6);
    });

    it("keeps a player who wins every game above the rating of a new player", () => {
      // 'a' wins 2 sets to 1 every time, but takes 24 points against 29
      const events: EventType[] = [player("a"), player("b")];
      for (let day = 0; day < 6; day++) {
        events.push(
          ...scoredGame(
            "a",
            "b",
            [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 2, gameLoser: 11 },
            ],
            day,
          ),
        );
      }

      const result = compute(events);
      const winner = lastRating(result, "a");

      // The points pull the rating down, but the game result still decides the sign
      expect(winner).toBeGreaterThan(1050);
      expect(winner).toBeLessThan(lastRating(compute(events, { levelWeights: GAME_LEVEL_ONLY }), "a"));
    });

    it("rates a player who sweeps the sets above one who drops a set", () => {
      const sweep: EventType[] = [player("a"), player("b")];
      const dropped: EventType[] = [player("c"), player("d")];
      for (let day = 0; day < 5; day++) {
        sweep.push(
          ...scoredGame(
            "a",
            "b",
            [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 11, gameLoser: 9 },
            ],
            day,
          ),
        );
        dropped.push(
          ...scoredGame(
            "c",
            "d",
            [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 9, gameLoser: 11 },
              { gameWinner: 11, gameLoser: 9 },
            ],
            day,
          ),
        );
      }

      expect(lastRating(compute(sweep), "a")).toBeGreaterThan(lastRating(compute(dropped), "c"));
    });

    it("rates a win where a set was dropped below the same games with no score", () => {
      // Losing a set is evidence that the two players are closer than the win
      // alone suggests, so a recorded score can lower a rating.
      const scored: EventType[] = [player("a"), player("b")];
      const bare: EventType[] = [player("a"), player("b")];
      for (let day = 0; day < 5; day++) {
        scored.push(
          ...scoredGame(
            "a",
            "b",
            [
              { gameWinner: 11, gameLoser: 9 },
              { gameWinner: 9, gameLoser: 11 },
              { gameWinner: 11, gameLoser: 9 },
            ],
            day,
          ),
        );
        bare.push(...games("a", "b", 1, day));
      }

      expect(lastRating(compute(scored), "a")).toBeLessThan(lastRating(compute(bare), "a"));
    });

    it("derives each level's slope from the probability lookups", () => {
      // A win fraction means something different per level, so each needs its own slope
      expect(SET_SLOPE).toBeCloseTo(0.666, 2);
      expect(POINT_SLOPE).toBeCloseTo(0.173, 2);
      expect(SET_SLOPE).toBeLessThan(1);
      expect(POINT_SLOPE).toBeLessThan(SET_SLOPE);

      // A 400 Elo gap is a 0.909 game win chance. The slopes must agree with the
      // lookups on what that means in sets and in points.
      const gap = Math.log(10);
      expect(1 / (1 + Math.exp(-gap * SET_SLOPE))).toBeCloseTo(0.822, 2);
      expect(1 / (1 + Math.exp(-gap * POINT_SLOPE))).toBeCloseTo(0.598, 2);
    });

    it("reports how many games carry a score", () => {
      const events: EventType[] = [player("a"), player("b")];
      events.push(...games("a", "b", 2));
      events.push(...scoredGame("a", "b", [{ gameWinner: 11, gameLoser: 4 }]));
      events.push({
        time: nextSequence(),
        stream: "game-sets-only",
        type: EventTypeEnum.GAME_CREATED,
        data: { playedAt: nextSequence(), winner: "a", loser: "b" },
      });
      events.push({
        time: nextSequence(),
        stream: "game-sets-only",
        type: EventTypeEnum.GAME_SCORE,
        data: { setsWon: { gameWinner: 2, gameLoser: 0 } },
      });

      expect(compute(events).coverage).toEqual({ games: 4, withSets: 2, withPoints: 1 });
    });
  });

  it("reports the configuration it used", () => {
    const result = compute([player("a"), player("b"), game("a", "b")], { driftPerDay: 12 });

    expect(result.config.driftPerDay).toBe(12);
    expect(result.config.anchorRating).toBe(1000);
    expect(result.iterations).toBeGreaterThan(0);
  });
});
