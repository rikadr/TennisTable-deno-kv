/** Fisher-Yates shuffle. Mutates and returns the same array. `random` must return a number in [0, 1) */
export function shuffleArray<T>(array: T[], random: () => number = Math.random): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/** True when both lists hold the same items one time each, in any order */
export function isSameSet<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== a.length || setB.size !== b.length) return false;
  return b.every((item) => setA.has(item));
}
