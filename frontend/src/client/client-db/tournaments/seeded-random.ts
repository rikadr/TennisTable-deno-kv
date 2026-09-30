// A local reference is faster than a lookup of the global Math object for each number
const imul = Math.imul;

/**
 * A random number generator that gives the same numbers for the same seeds. It uses the mulberry32
 * generator. The seeds are mixed into one 32 bit state.
 */
export function seededRandom(...seeds: number[]): () => number {
  let state = 0x9e3779b9;
  for (const seed of seeds) {
    state = imul(state ^ seed, 0x85ebca6b);
    state ^= state >>> 13;
    state = imul(state, 0xc2b2ae35);
    state ^= state >>> 16;
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = imul(state ^ (state >>> 15), 1 | state);
    t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
