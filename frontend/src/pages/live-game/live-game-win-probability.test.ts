import { computeLiveWinPrediction, LiveWinPredictionInput } from "./live-game-win-probability";

const freshGame = (
  base: Pick<LiveWinPredictionInput, "basePlayer1WinChance" | "baseConfidence">,
): LiveWinPredictionInput => ({
  ...base,
  setsWon: { player1: 0, player2: 0 },
  currentSet: { player1: 0, player2: 0 },
  completedSets: [],
});

describe("computeLiveWinPrediction", () => {
  it("reproduces the pairing prediction at the start of the game", () => {
    const { player1WinChance, confidence } = computeLiveWinPrediction(
      freshGame({ basePlayer1WinChance: 0.65, baseConfidence: 0.5 }),
    );
    expect(player1WinChance).toBeCloseTo(0.65, 2);
    expect(confidence).toBeCloseTo(0.5, 2);
  });

  it("reproduces an even no-data prediction at the start", () => {
    const { player1WinChance, confidence } = computeLiveWinPrediction(
      freshGame({ basePlayer1WinChance: 0.5, baseConfidence: 0 }),
    );
    expect(player1WinChance).toBeCloseTo(0.5, 2);
    expect(confidence).toBeCloseTo(0, 2);
  });

  it("raises the win chance and confidence when player 1 leads", () => {
    const base = freshGame({ basePlayer1WinChance: 0.5, baseConfidence: 0.5 });
    const leading = computeLiveWinPrediction({ ...base, currentSet: { player1: 7, player2: 2 } });
    expect(leading.player1WinChance).toBeGreaterThan(0.5);
    expect(leading.confidence).toBeGreaterThan(0.5);
  });

  it("lowers the win chance when player 1 trails", () => {
    const base = freshGame({ basePlayer1WinChance: 0.5, baseConfidence: 0.5 });
    const trailing = computeLiveWinPrediction({ ...base, currentSet: { player1: 2, player2: 7 } });
    expect(trailing.player1WinChance).toBeLessThan(0.5);
  });

  it("converges toward certainty as the match nears its end", () => {
    // Player 1 up a set and holding match point in the second set.
    const nearWin = computeLiveWinPrediction({
      basePlayer1WinChance: 0.5,
      baseConfidence: 0.5,
      setsWon: { player1: 1, player2: 0 },
      currentSet: { player1: 10, player2: 4 },
      completedSets: [{ player1: 11, player2: 6 }],
    });
    expect(nearWin.player1WinChance).toBeGreaterThan(0.97);
    expect(nearWin.confidence).toBeGreaterThan(0.95);
  });

  it("returns a decided result once a player has won two sets", () => {
    const decided = computeLiveWinPrediction({
      basePlayer1WinChance: 0.5,
      baseConfidence: 0.5,
      setsWon: { player1: 2, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [
        { player1: 11, player2: 5 },
        { player1: 11, player2: 8 },
      ],
    });
    expect(decided.player1WinChance).toBe(1);
    expect(decided.confidence).toBe(1);
  });

  it("keeps a genuine coin-flip decider uncertain", () => {
    const decider = computeLiveWinPrediction({
      basePlayer1WinChance: 0.5,
      baseConfidence: 0.5,
      setsWon: { player1: 1, player2: 1 },
      currentSet: { player1: 10, player2: 10 },
      completedSets: [
        { player1: 11, player2: 7 },
        { player1: 7, player2: 11 },
      ],
    });
    expect(decider.player1WinChance).toBeGreaterThan(0.4);
    expect(decider.player1WinChance).toBeLessThan(0.6);
  });

  it("builds a confident prediction from live points alone when there is no pairing data", () => {
    const dominating = computeLiveWinPrediction({
      basePlayer1WinChance: 0.5,
      baseConfidence: 0,
      setsWon: { player1: 1, player2: 0 },
      currentSet: { player1: 9, player2: 1 },
      completedSets: [{ player1: 11, player2: 2 }],
    });
    expect(dominating.player1WinChance).toBeGreaterThan(0.9);
    expect(dominating.confidence).toBeGreaterThan(0.9);
  });
});
