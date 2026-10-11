import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { GAME_CONFIDENCE_CONFIG, POINT_CONFIDENCE_CONFIG, Predictions, SET_CONFIDENCE_CONFIG } from "../predictions";
import { gameToGame, pointToGame, setToGame } from "../future-elo-probability-lookups";
import { PairStats } from "../pair-stats";
import { PlayerStrengths } from "../player-strengths";

// The confidence curve itself is covered in future-elo.test.ts. These tests
// cover the win-probability outputs and the deterministic fraction helpers.

// A fixed reference time keeps the age-adjusted weights deterministic (games
// played milliseconds before the reference time have a weight of ~1).
const T0 = 1_000_000;

function playerEvent(stream: string, name: string, time: number): EventType {
  return { time, stream, type: EventTypeEnum.PLAYER_CREATED, data: { name } };
}

type SetPoints = { gameWinner: number; gameLoser: number }[];

function buildTennisTable(
  games: [winner: string, loser: string][],
  extraEvents: EventType[] = [],
  setPointsOf?: (gameIndex: number) => SetPoints,
): TennisTable {
  const players = Array.from(new Set(games.flat()));
  const events: EventType[] = [...extraEvents, ...players.map((p, i) => playerEvent(p, p, 1000 + i))];
  games.forEach(([winner, loser], i) => {
    events.push({
      time: T0 + i,
      stream: `game-${i}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt: T0 + i, winner, loser },
    });
    const setPoints = setPointsOf?.(i);
    if (setPoints) {
      events.push({
        time: T0 + i,
        stream: `game-${i}`,
        type: EventTypeEnum.GAME_SCORE,
        data: {
          setsWon: {
            gameWinner: setPoints.filter((set) => set.gameWinner > set.gameLoser).length,
            gameLoser: setPoints.filter((set) => set.gameLoser > set.gameWinner).length,
          },
          setPoints,
        },
      });
    }
  });
  return new TennisTable({ events, referenceTime: T0 + games.length });
}

describe("Predictions.getWinFractionWithConfidence", () => {
  it("maps the raw win fraction through the game lookup (identity for games)", () => {
    // gameToGame is the identity lookup, so 3 wins to 1 loss gives 0.75
    const result = Predictions.getWinFractionWithConfidence(3, 1, gameToGame, GAME_CONFIDENCE_CONFIG);
    expect(result.fraction).toBeCloseTo(0.75, 10);
  });

  it("interpolates between lookup entries for fractional indexes", () => {
    // 1 win to 2 losses = 1/3: index 33.33 interpolates between 0.33 and 0.34
    const result = Predictions.getWinFractionWithConfidence(1, 2, gameToGame, GAME_CONFIDENCE_CONFIG);
    expect(result.fraction).toBeCloseTo(1 / 3, 10);
  });

  it("gives the complement for the other player with the set and point lookups", () => {
    // The set and point lookups are not exactly symmetric, so the app uses the average of the two directions
    for (const [lookup, config] of [
      [setToGame, SET_CONFIDENCE_CONFIG],
      [pointToGame, POINT_CONFIDENCE_CONFIG],
    ] as const) {
      for (const [wins, loss] of [
        [3, 1],
        [7.3, 2.1],
        [1, 9],
      ]) {
        const forward = Predictions.getWinFractionWithConfidence(wins, loss, lookup, config);
        const backward = Predictions.getWinFractionWithConfidence(loss, wins, lookup, config);
        expect(forward.fraction + backward.fraction).toBeCloseTo(1, 12);
        expect(forward.confidence).toBeCloseTo(backward.confidence, 12);
      }
    }
  });

  it("handles the all-wins and all-losses edges of the lookup", () => {
    expect(Predictions.getWinFractionWithConfidence(5, 0, gameToGame, GAME_CONFIDENCE_CONFIG).fraction).toBe(1);
    expect(Predictions.getWinFractionWithConfidence(0, 5, gameToGame, GAME_CONFIDENCE_CONFIG).fraction).toBe(0);
  });
});

describe("Predictions.combinePrioritizedFractions", () => {
  it("lets a fully confident first source occupy all the space", () => {
    const combined = Predictions.combinePrioritizedFractions([
      { fraction: 0.7, confidence: 1 },
      { fraction: 0.1, confidence: 1 },
    ]);
    expect(combined.fraction).toBeCloseTo(0.7, 10);
    expect(combined.confidence).toBeCloseTo(1, 10);
  });

  it("fills remaining uncertainty with the lower priority source", () => {
    // First source takes 50% of the space; the second (full confidence) takes the rest
    const combined = Predictions.combinePrioritizedFractions([
      { fraction: 1, confidence: 0.5 },
      { fraction: 0, confidence: 1 },
    ]);
    expect(combined.fraction).toBeCloseTo(0.5, 10);
  });

  it("skips undefined entries and zero-confidence entries contribute nothing", () => {
    const combined = Predictions.combinePrioritizedFractions([
      undefined,
      { fraction: 0.2, confidence: 0 },
      { fraction: 0.8, confidence: 0.5 },
    ]);
    expect(combined.fraction).toBeCloseTo(0.8, 10);
  });

  it("returns zero when no source has confidence", () => {
    expect(Predictions.combinePrioritizedFractions([{ fraction: 0.9, confidence: 0 }])).toEqual({
      fraction: 0,
      confidence: 0,
    });
  });
});

describe("Predictions direct win probability from games", () => {
  it("predicts the head-to-head win fraction from game results", () => {
    // A beats B 3 times, B beats A once: A wins 75% of games
    const tt = buildTennisTable([
      ["A", "B"],
      ["A", "B"],
      ["A", "B"],
      ["B", "A"],
    ]);
    const fraction = tt.predictions.getDirectFraction("A", "B");

    expect(fraction.fraction).toBeCloseTo(0.75, 5);
    expect(fraction.confidence).toBeGreaterThan(0);
    expect(fraction.confidence).toBeLessThan(1);
  });

  it("gives the complement fraction with the same confidence for the reverse matchup", () => {
    const tt = buildTennisTable([
      ["A", "B"],
      ["A", "B"],
      ["A", "B"],
      ["B", "A"],
    ]);
    const forward = tt.predictions.getDirectFraction("A", "B");
    const backward = tt.predictions.getDirectFraction("B", "A");

    expect(forward.fraction + backward.fraction).toBeCloseTo(1, 5);
    expect(forward.confidence).toBeCloseTo(backward.confidence, 10);
  });

  it("returns zero confidence for players who never met", () => {
    const tt = buildTennisTable([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(tt.predictions.getDirectFraction("A", "C")).toEqual({ fraction: 0, confidence: 0 });
  });

  it("exposes raw and weighted game stats", () => {
    const tt = buildTennisTable([
      ["A", "B"],
      ["A", "B"],
      ["B", "A"],
    ]);
    const stats = tt.predictions.getDirectGameStats("A", "B");

    expect(stats.won).toBe(2);
    expect(stats.lost).toBe(1);
    expect(stats.weightedWins).toBeCloseTo(2, 5);
    expect(stats.weightedLost).toBeCloseTo(1, 5);
    expect(stats.fraction.fraction).toBeCloseTo(2 / 3, 5);
  });
});

describe("Predictions from all games", () => {
  // Every pair of P1, A, B and P2 played, except P1 and P2
  const games: [string, string][] = [
    ["P1", "A"],
    ["P1", "A"],
    ["A", "P1"],
    ["P1", "B"],
    ["B", "P1"],
    ["B", "P1"],
    ["A", "B"],
    ["A", "B"],
    ["A", "B"],
    ["B", "A"],
    ["A", "P2"],
    ["P2", "A"],
    ["P2", "A"],
    ["B", "P2"],
    ["B", "P2"],
    ["B", "P2"],
    ["P2", "B"],
  ];

  const chainGames: [string, string][] = [
    // A beats M 3 of 4
    ["A", "M"],
    ["A", "M"],
    ["A", "M"],
    ["M", "A"],
    // M beats B 3 of 4
    ["M", "B"],
    ["M", "B"],
    ["M", "B"],
    ["B", "M"],
  ];

  it("gives the complement fraction with the same confidence for the reverse pair", () => {
    // A new TennisTable for each direction, so no value comes from the cache of the other direction
    const forward = buildTennisTable(games).predictions;
    const backward = buildTennisTable(games).predictions;

    for (const [p1, p2] of [
      ["P1", "P2"],
      ["P1", "B"],
      ["A", "P2"],
    ]) {
      const there = forward.getPredictedFraction(p1, p2)!;
      const back = backward.getPredictedFraction(p2, p1)!;
      expect(there.fraction + back.fraction).toBeCloseTo(1, 12);
      expect(there.confidence).toBeCloseTo(back.confidence, 12);
    }
  });

  it("predicts 2 players who never played each other from a common opponent", () => {
    const predictions = buildTennisTable(chainGames).predictions;
    const aAgainstB = predictions.getPredictedFraction("A", "B")!;

    // A is stronger than M, and M is stronger than B, so A is the favourite against B by more
    expect(aAgainstB.fraction).toBeGreaterThan(predictions.getPredictedFraction("A", "M")!.fraction);
    expect(predictions.getPredictedFraction("A", "M")!.fraction).toBeGreaterThan(0.5);
    expect(aAgainstB.confidence).toBeGreaterThan(0);
  });

  it("adds the games against other opponents to a pair with few games", () => {
    // B won the only game against A, but A won all the games against 3 players that beat B
    const pair: [string, string][] = [["B", "A"]];
    const others: [string, string][] = [];
    for (const opponent of ["X", "Y", "Z"]) {
      for (let i = 0; i < 4; i++) others.push(["A", opponent], [opponent, "B"]);
    }
    const directOnly = buildTennisTable(pair).predictions.getPredictedFraction("A", "B")!;
    const allGames = buildTennisTable([...pair, ...others]).predictions;

    expect(directOnly.fraction).toBeLessThan(0.5);
    expect(allGames.getPredictedFraction("A", "B")!.fraction).toBeGreaterThan(0.5);
    expect(allGames.getPredictedFraction("A", "B")!.confidence).toBeGreaterThan(directOnly.confidence);
  });

  it("gives more confidence with more games", () => {
    const fewGames = buildTennisTable([
      ["A", "B"],
      ["B", "A"],
    ]).predictions.getPredictedFraction("A", "B")!;
    const manyGames = buildTennisTable(
      Array.from({ length: 20 }, (_, i): [string, string] => (i % 2 === 0 ? ["A", "B"] : ["B", "A"])),
    ).predictions.getPredictedFraction("A", "B")!;

    expect(fewGames.fraction).toBeCloseTo(0.5, 10);
    expect(manyGames.confidence).toBeGreaterThan(fewGames.confidence);
    expect(manyGames.confidence).toBeLessThan(1);
  });

  it("gives 50% with low confidence for players with no chain of opponents between them", () => {
    const predicted = buildTennisTable([
      ["A", "B"],
      ["C", "D"],
    ]).predictions.getPredictedFraction("A", "C")!;

    expect(predicted.fraction).toBeCloseTo(0.5, 10);
    expect(predicted.confidence).toBeLessThan(0.1);
  });

  it("gives no prediction for a player with no games", () => {
    const events: EventType[] = [playerEvent("X", "X", 900)];
    const tt = buildTennisTable(chainGames, events);
    tt.predictions.getPredictedFraction("A", "X");

    expect(tt.predictions.getPredictedFraction("A", "X")).toBeUndefined();
    expect(tt.predictions.getPredictedFraction("A", "A")).toBeUndefined();
  });

  it("counts the game result before the sets and the points", () => {
    // A won 6 of 6 games by 2 sets to 1, but took fewer points than B in each game
    const sets = [
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 2, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 9 },
    ];
    const tt = buildTennisTable(
      Array.from({ length: 6 }, (): [string, string] => ["A", "B"]),
      [],
      () => sets,
    );

    expect(tt.predictions.getPredictedFraction("A", "B")!.fraction).toBeGreaterThan(0.6);
  });

  it("gives the same prediction with shared strengths over many reference times as with a new fit", () => {
    const tt = buildTennisTable([...games, ...chainGames]);
    const allGames = tt.games;
    const strengths = new PlayerStrengths(new PairStats(T0 + allGames.length, allGames));

    for (let time = T0 + allGames.length; time >= T0 + 5; time -= 3) {
      strengths.pairStats.rewindTo(time);
      const shared = new Predictions(tt, time, strengths);
      const fresh = new Predictions(
        tt,
        time,
        allGames.filter((g) => g.playedAt <= time),
      );
      for (const [p1, p2] of [
        ["P1", "P2"],
        ["A", "B"],
        ["M", "P2"],
      ]) {
        const a = shared.getPredictedFraction(p1, p2);
        const b = fresh.getPredictedFraction(p1, p2);
        expect(a === undefined).toBe(b === undefined);
        if (!a || !b) continue;
        // The fit stops at a tolerance, and the confidence uses the Hessian of the last step
        expect(a.fraction).toBeCloseTo(b.fraction, 5);
        expect(a.confidence).toBeCloseTo(b.confidence, 4);
      }
    }
  });

  it("gives the same prediction when called again, and the complement for the reverse pair", () => {
    const tt = buildTennisTable(chainGames);
    const first = tt.predictions.getPredictedFraction("A", "B")!;

    expect(tt.predictions.getPredictedFraction("A", "B")).toEqual(first);
    expect(tt.predictions.getPredictedFraction("B", "A")!.fraction).toBeCloseTo(1 - first.fraction, 12);
  });

  it("counts total games per player and lists all player ids", () => {
    const tt = buildTennisTable(chainGames);

    expect(tt.predictions.getPlayerTotalGames("A")).toBe(4);
    expect(tt.predictions.getPlayerTotalGames("M")).toBe(8);
    expect(tt.predictions.getPlayerTotalGames("B")).toBe(4);
    expect(tt.predictions.getAllPlayerIds().sort()).toEqual(["A", "B", "M"]);
  });
});
