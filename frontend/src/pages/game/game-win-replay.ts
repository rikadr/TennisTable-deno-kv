import { computeLiveWinPrediction } from "../live-game/live-game-win-probability";

/**
 * Deterministic RNG (mulberry32). The replayed win % graph re-runs the live
 * Monte-Carlo model per point; a seed fixed to the game keeps the graph the
 * same every time the page renders.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Replays a game's stored point sequences through the live win-prediction
 * model, as if the game were tracked live: one win-chance sample after every
 * point, from the game winner's perspective. `preGameWinChance` and
 * `preGameConfidence` are the pairing prediction as it stood before the game.
 */
export function replayWinPercentHistory(params: {
  /** One string per set, "W"/"L" per point — the GAME_SCORE pointSequences. */
  pointSequences: string[];
  /** The game winner's pre-game chance to win the match, [0, 1]. */
  preGameWinChance: number;
  preGameConfidence: number;
  seed: number;
  simulations?: number;
}): number[] {
  const { pointSequences, preGameWinChance, preGameConfidence, seed, simulations } = params;
  const random = seededRandom(seed);

  const history: number[] = [];
  const setsWon = { player1: 0, player2: 0 };
  const completedSets: { player1: number; player2: number }[] = [];

  for (const sequence of pointSequences) {
    const currentSet = { player1: 0, player2: 0 };
    for (const point of sequence) {
      if (point === "W") currentSet.player1++;
      else currentSet.player2++;
      history.push(
        computeLiveWinPrediction({
          preGameWinChance,
          preGameConfidence,
          setsWon: { ...setsWon },
          currentSet: { ...currentSet },
          completedSets: [...completedSets],
          simulations,
          random,
        }).player1WinChance,
      );
    }
    completedSets.push(currentSet);
    if (currentSet.player1 > currentSet.player2) setsWon.player1++;
    else setsWon.player2++;
  }

  return history;
}
