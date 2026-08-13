import { replayWinPercentHistory, seededRandom } from "./game-win-replay";

// 11-5 and 11-7 to the game winner, winner scoring the last point of each set.
const SEQUENCES = ["WWLWWLWWLWWLWWLW", "WLWLWLWLWLWLWLWWWW"];

describe("seededRandom", () => {
  it("is deterministic for a seed and produces values in [0, 1)", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 100; i++) {
      const value = a();
      expect(value).toBe(b());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("differs between seeds", () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe("replayWinPercentHistory", () => {
  const input = {
    pointSequences: SEQUENCES,
    preGameWinChance: 0.6,
    preGameConfidence: 0.5,
    seed: 1234,
    simulations: 200,
  };

  it("produces one sample per point, all within [0, 1]", () => {
    const history = replayWinPercentHistory(input);
    const totalPoints = SEQUENCES.reduce((sum, sequence) => sum + sequence.length, 0);
    expect(history).toHaveLength(totalPoints);
    history.forEach((sample) => {
      expect(sample).toBeGreaterThanOrEqual(0);
      expect(sample).toBeLessThanOrEqual(1);
    });
  });

  it("ends certain of the winner once the deciding set is decided", () => {
    const history = replayWinPercentHistory(input);
    // The final point decides the winner's 2nd set (11-7, 2 clear), so the
    // normalized score has the match won and every simulation is a win.
    expect(history.at(-1)).toBe(1);
  });

  it("is deterministic for the same seed", () => {
    expect(replayWinPercentHistory(input)).toEqual(replayWinPercentHistory(input));
  });
});
