import { computeLiveWinPrediction, LiveWinPredictionInput } from "./live-game-win-probability";

// Deterministic RNG so the Monte-Carlo simulation is reproducible in tests.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const freshGame = (
  base: Pick<LiveWinPredictionInput, "preGameWinChance" | "preGameConfidence">,
): LiveWinPredictionInput => ({
  ...base,
  setsWon: { player1: 0, player2: 0 },
  currentSet: { player1: 0, player2: 0 },
  completedSets: [],
  simulations: 20000,
  random: seededRandom(12345),
});

describe("computeLiveWinPrediction", () => {
  it("reproduces the pre-game prediction at the start of the game", () => {
    const { player1WinChance, confidence } = computeLiveWinPrediction(
      freshGame({ preGameWinChance: 0.65, preGameConfidence: 0.5 }),
    );
    expect(player1WinChance).toBeCloseTo(0.65, 1);
    expect(confidence).toBeCloseTo(0.5, 1);
  });

  it("reproduces an even no-data prediction at the start", () => {
    const { player1WinChance, confidence } = computeLiveWinPrediction(
      freshGame({ preGameWinChance: 0.5, preGameConfidence: 0 }),
    );
    expect(player1WinChance).toBeCloseTo(0.5, 1);
    expect(confidence).toBeCloseTo(0, 2);
  });

  it("raises the win chance and confidence when player 1 leads", () => {
    const base = freshGame({ preGameWinChance: 0.5, preGameConfidence: 0.5 });
    const leading = computeLiveWinPrediction({ ...base, currentSet: { player1: 8, player2: 2 } });
    expect(leading.player1WinChance).toBeGreaterThan(0.5);
    expect(leading.confidence).toBeGreaterThan(0.5);
  });

  it("lowers the win chance when player 1 trails", () => {
    const base = freshGame({ preGameWinChance: 0.5, preGameConfidence: 0.5 });
    const trailing = computeLiveWinPrediction({ ...base, currentSet: { player1: 2, player2: 8 } });
    expect(trailing.player1WinChance).toBeLessThan(0.5);
  });

  it("derives a per-point win chance below the match win chance for a favourite", () => {
    const { perPointWinChance, player1WinChance } = computeLiveWinPrediction(
      freshGame({ preGameWinChance: 0.8, preGameConfidence: 0.6 }),
    );
    // A big match-win edge comes from a much smaller per-point edge.
    expect(perPointWinChance).toBeGreaterThan(0.5);
    expect(perPointWinChance).toBeLessThan(player1WinChance);
  });

  it("converges toward certainty as the match nears its end", () => {
    const nearWin = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 1, player2: 0 },
      currentSet: { player1: 10, player2: 4 },
      completedSets: [{ player1: 11, player2: 6 }],
      simulations: 20000,
      random: seededRandom(999),
    });
    expect(nearWin.player1WinChance).toBeGreaterThan(0.95);
    expect(nearWin.confidence).toBeGreaterThan(0.9);
  });

  it("returns a decided result once a player has won two sets", () => {
    const decided = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 2, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 11, player2: 8 },
      ],
      simulations: 1000,
      random: seededRandom(1),
    });
    expect(decided.player1WinChance).toBe(1);
    expect(decided.confidence).toBe(1);
  });

  it("keeps a coin-flip decider's win chance even but stays confident it is close", () => {
    const decider = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 1, player2: 1 },
      currentSet: { player1: 10, player2: 10 },
      completedSets: [
        { player1: 11, player2: 7 },
        { player1: 7, player2: 11 },
      ],
      simulations: 20000,
      random: seededRandom(7),
    });
    // The win chance is a genuine coin flip...
    expect(decider.player1WinChance).toBeGreaterThan(0.4);
    expect(decider.player1WinChance).toBeLessThan(0.6);
    // ...but the match is all but over, so we are ~fully confident in that
    // 50/50 prediction.
    expect(decider.confidence).toBeGreaterThan(0.95);
  });

  it("gives the same prediction just before and just after a won set is confirmed", () => {
    const beforeConfirm = computeLiveWinPrediction({
      preGameWinChance: 0.65,
      preGameConfidence: 0.5,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 11, player2: 5 },
      completedSets: [],
      simulations: 20000,
      random: seededRandom(21),
    });
    const afterConfirm = computeLiveWinPrediction({
      preGameWinChance: 0.65,
      preGameConfidence: 0.5,
      setsWon: { player1: 1, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [{ player1: 11, player2: 5 }],
      simulations: 20000,
      random: seededRandom(21),
    });
    // A decided current set counts as a completed set, so the two states are
    // the same input and the same seed gives the same prediction.
    expect(afterConfirm.player1WinChance).toBeCloseTo(beforeConfirm.player1WinChance, 6);
    expect(afterConfirm.confidence).toBeCloseTo(beforeConfirm.confidence, 6);
  });

  it("keeps the extension after its set is confirmed, before the next set starts", () => {
    const beforeConfirm = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 2, player2: 0 },
      currentSet: { player1: 5, player2: 11 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 11, player2: 8 },
      ],
      simulations: 20000,
      random: seededRandom(22),
    });
    const afterConfirm = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 2, player2: 1 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 11, player2: 8 },
        { player1: 5, player2: 11 },
      ],
      simulations: 20000,
      random: seededRandom(22),
    });
    // 2-1 reached through 2-0 stays a best of 5, so the match is not decided...
    expect(afterConfirm.player1WinChance).toBeLessThan(1);
    expect(afterConfirm.player1WinChance).toBeGreaterThan(0.5);
    // ...and confirming the extension set does not move the prediction.
    expect(afterConfirm.player1WinChance).toBeCloseTo(beforeConfirm.player1WinChance, 6);
    expect(afterConfirm.confidence).toBeCloseTo(beforeConfirm.confidence, 6);
  });

  it("extends to best of 5 when a 3rd set starts after 2-0", () => {
    const extended = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 2, player2: 0 },
      currentSet: { player1: 0, player2: 1 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 11, player2: 8 },
      ],
      simulations: 20000,
      random: seededRandom(3),
    });
    // The match is live again: player 1 is still the favourite (needs 1 of the
    // next 3 sets) but is no longer locked at 100%.
    expect(extended.player1WinChance).toBeGreaterThan(0.5);
    expect(extended.player1WinChance).toBeLessThan(1);
  });

  it("extends to best of 5 when a 4th set starts after 2-1", () => {
    const extended = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 2, player2: 1 },
      currentSet: { player1: 1, player2: 0 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 8, player2: 11 },
        { player1: 11, player2: 9 },
      ],
      simulations: 20000,
      random: seededRandom(4),
    });
    expect(extended.player1WinChance).toBeGreaterThan(0.5);
    expect(extended.player1WinChance).toBeLessThan(1);
  });

  it("extends to best of 7 when a set starts after 3 won sets", () => {
    const extended = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 3, player2: 1 },
      currentSet: { player1: 0, player2: 2 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 8, player2: 11 },
        { player1: 11, player2: 9 },
        { player1: 11, player2: 7 },
      ],
      simulations: 20000,
      random: seededRandom(5),
    });
    expect(extended.player1WinChance).toBeGreaterThan(0.5);
    expect(extended.player1WinChance).toBeLessThan(1);
  });

  it("stays decided at 3-1 when no further set has started", () => {
    const decided = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0.5,
      setsWon: { player1: 3, player2: 1 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 8, player2: 11 },
        { player1: 11, player2: 9 },
        { player1: 11, player2: 7 },
      ],
      simulations: 1000,
      random: seededRandom(6),
    });
    expect(decided.player1WinChance).toBe(1);
    expect(decided.confidence).toBe(1);
  });

  it("builds a confident prediction from live points alone when there is no pairing data", () => {
    const dominating = computeLiveWinPrediction({
      preGameWinChance: 0.5,
      preGameConfidence: 0,
      setsWon: { player1: 1, player2: 0 },
      currentSet: { player1: 9, player2: 1 },
      completedSets: [{ player1: 11, player2: 2 }],
      simulations: 20000,
      random: seededRandom(42),
    });
    expect(dominating.player1WinChance).toBeGreaterThan(0.9);
    expect(dominating.confidence).toBeGreaterThan(0.85);
  });
});
