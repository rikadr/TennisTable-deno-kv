import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { GAME_CONFIDENCE_CONFIG, Predictions } from "../predictions";
import { gameToGame } from "../future-elo-probability-lookups";

// The confidence curve itself is covered in future-elo.test.ts. These tests
// cover the win-probability outputs and the deterministic fraction helpers.

// A fixed reference time keeps the age-adjusted weights deterministic (games
// played milliseconds before the reference time have a weight of ~1).
const T0 = 1_000_000;

function playerEvent(stream: string, name: string, time: number): EventType {
  return { time, stream, type: EventTypeEnum.PLAYER_CREATED, data: { name } };
}

function buildTennisTable(games: [winner: string, loser: string][]): TennisTable {
  const players = Array.from(new Set(games.flat()));
  const events: EventType[] = players.map((p, i) => playerEvent(p, p, 1000 + i));
  games.forEach(([winner, loser], i) => {
    events.push({
      time: T0 + i,
      stream: `game-${i}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt: T0 + i, winner, loser },
    });
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

  it("handles the all-wins and all-losses edges of the lookup", () => {
    expect(Predictions.getWinFractionWithConfidence(5, 0, gameToGame, GAME_CONFIDENCE_CONFIG).fraction).toBe(1);
    expect(Predictions.getWinFractionWithConfidence(0, 5, gameToGame, GAME_CONFIDENCE_CONFIG).fraction).toBe(0);
  });
});

describe("Predictions.linkFractions", () => {
  it("links two even fractions into an even fraction", () => {
    const linked = Predictions.linkFractions({ fraction: 0.5, confidence: 1 }, { fraction: 0.5, confidence: 1 });
    expect(linked.fraction).toBeCloseTo(0.5, 10);
    expect(linked.confidence).toBe(1);
  });

  it("amplifies two advantages through the Bradley-Terry chain", () => {
    // Two 0.75 links: 0.75*0.75 / (0.75*0.75 + 0.25*0.25) = 0.9
    const linked = Predictions.linkFractions({ fraction: 0.75, confidence: 1 }, { fraction: 0.75, confidence: 1 });
    expect(linked.fraction).toBeCloseTo(0.9, 10);
  });

  it("multiplies the confidences of the two links", () => {
    const linked = Predictions.linkFractions({ fraction: 0.6, confidence: 0.5 }, { fraction: 0.6, confidence: 0.4 });
    expect(linked.confidence).toBeCloseTo(0.2, 10);
  });

  it("gives no information for a link of 0 and a link of 1", () => {
    // Before the fix, both directions of this chain gave 0
    const linked = Predictions.linkFractions({ fraction: 0, confidence: 1 }, { fraction: 1, confidence: 1 });
    expect(linked).toEqual({ fraction: 0.5, confidence: 0 });
  });

  it("is symmetric: the reverse chain gives the complement fraction", () => {
    const forward = Predictions.linkFractions({ fraction: 0.7, confidence: 1 }, { fraction: 0.6, confidence: 1 });
    const backward = Predictions.linkFractions({ fraction: 0.3, confidence: 1 }, { fraction: 0.4, confidence: 1 });
    expect(forward.fraction + backward.fraction).toBeCloseTo(1, 10);
  });
});

describe("Predictions.combineFractions", () => {
  it("returns zero for an empty or undefined-only list", () => {
    expect(Predictions.combineFractions([])).toEqual({ fraction: 0, confidence: 0 });
    expect(Predictions.combineFractions([undefined, undefined])).toEqual({ fraction: 0, confidence: 0 });
  });

  it("returns a single fraction unchanged", () => {
    const combined = Predictions.combineFractions([{ fraction: 0.8, confidence: 0.5 }]);
    expect(combined.fraction).toBeCloseTo(0.8, 10);
    expect(combined.confidence).toBeCloseTo(0.5, 10);
  });

  it("averages equally confident fractions", () => {
    const combined = Predictions.combineFractions([
      { fraction: 0.8, confidence: 0.5 },
      { fraction: 0.4, confidence: 0.5 },
    ]);
    expect(combined.fraction).toBeCloseTo(0.6, 10);
  });

  it("weights fractions by confidence", () => {
    const combined = Predictions.combineFractions([
      { fraction: 1, confidence: 0.9 },
      { fraction: 0, confidence: 0.1 },
    ]);
    expect(combined.fraction).toBeCloseTo(0.9, 10);
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

describe("Predictions symmetry", () => {
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

  it("counts the chains P1→A→B→P2 and P1→B→A→P2 in the two-layer fraction", () => {
    const predictions = buildTennisTable(games).predictions;
    const direct = (a: string, b: string) => predictions.getDirectFraction(a, b);
    const chain = (a: string, b: string) =>
      Predictions.linkFractions(Predictions.linkFractions(direct("P1", a), direct(a, b)), direct(b, "P2"));

    const expected = Predictions.combineFractions([chain("A", "B"), chain("B", "A")]);
    const twoLayer = predictions.getTwoLayerFraction("P1", "P2");

    expect(twoLayer.fraction).toBeCloseTo(expected.fraction, 10);
    expect(twoLayer.confidence).toBeCloseTo(expected.confidence, 10);
  });

  it("gives the complement fraction for the reverse pair, in each layer", () => {
    // A new TennisTable for each direction, so no value comes from the cache of the other direction
    const forward = buildTennisTable(games).predictions;
    const backward = buildTennisTable(games).predictions;

    for (const [p1, p2] of [
      ["P1", "P2"],
      ["P1", "B"],
      ["A", "P2"],
    ]) {
      const layers = (predictions: Predictions, a: string, b: string) => [
        predictions.getDirectFraction(a, b),
        predictions.getOneLayerFraction(a, b),
        predictions.getTwoLayerFraction(a, b),
        predictions.getPredictedFraction(a, b)!,
      ];
      const forwardLayers = layers(forward, p1, p2);
      const backwardLayers = layers(backward, p2, p1);
      forwardLayers.forEach((layer, i) => {
        if (layer.confidence === 0) return;
        expect(layer.fraction + backwardLayers[i].fraction).toBeCloseTo(1, 12);
        expect(layer.confidence).toBeCloseTo(backwardLayers[i].confidence, 12);
      });
    }
  });
});

describe("Predictions transitive (one-layer) probability", () => {
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

  it("finds the common opponents between two players", () => {
    const tt = buildTennisTable(chainGames);
    expect(tt.predictions.getCommonOpponents("A", "B")).toEqual(["M"]);
    expect(tt.predictions.getCommonOpponents("A", "M")).toEqual([]);
  });

  it("links win fractions through a common opponent", () => {
    const tt = buildTennisTable(chainGames);
    // 0.75 linked with 0.75 through the Bradley-Terry model = 0.9
    const oneLayer = tt.predictions.getOneLayerFraction("A", "B");

    expect(oneLayer.fraction).toBeCloseTo(0.9, 3);
    expect(oneLayer.confidence).toBeGreaterThan(0);
  });

  it("combines the layers into a predicted fraction when there is no direct data", () => {
    const tt = buildTennisTable(chainGames);
    const predicted = tt.predictions.getPredictedFraction("A", "B");

    expect(predicted).toBeDefined();
    expect(predicted!.fraction).toBeCloseTo(0.9, 3);
  });

  it("returns undefined when no path between the players exists", () => {
    const tt = buildTennisTable([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(tt.predictions.getPredictedFraction("A", "C")).toBeUndefined();
  });

  it("gives the same prediction when called again, and a separate one for the reverse pair", () => {
    const tt = buildTennisTable(chainGames);
    const first = tt.predictions.getPredictedFraction("A", "B");

    expect(tt.predictions.getPredictedFraction("A", "B")).toEqual(first);
    expect(tt.predictions.getPredictedFraction("B", "A")!.fraction).toBeCloseTo(0.1, 3);
  });

  it("gives undefined again for a pair with no prediction", () => {
    const tt = buildTennisTable([
      ["A", "B"],
      ["C", "D"],
    ]);
    tt.predictions.getPredictedFraction("A", "C");

    expect(tt.predictions.getPredictedFraction("A", "C")).toBeUndefined();
  });

  it("counts total games per player and lists all player ids", () => {
    const tt = buildTennisTable(chainGames);

    expect(tt.predictions.getPlayerTotalGames("A")).toBe(4);
    expect(tt.predictions.getPlayerTotalGames("M")).toBe(8);
    expect(tt.predictions.getPlayerTotalGames("B")).toBe(4);
    expect(tt.predictions.getAllPlayerIds().sort()).toEqual(["A", "B", "M"]);
  });
});
