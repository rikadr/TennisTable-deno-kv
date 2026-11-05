export type OpponentPair = {
  player1: string;
  player2: string;
  games: number;
  /** Any value that increases with time, for example the index of the last game. */
  lastPlayed: number;
};

/**
 * Returns the opponents of each player, ordered by game count, most first.
 * On a tie, the opponent with the more recent game ranks higher.
 */
export function rankOpponents(pairs: OpponentPair[]): Map<string, string[]> {
  const opponents = new Map<string, OpponentPair[]>();
  const add = (player: string, pair: OpponentPair) => {
    const list = opponents.get(player);
    if (list) list.push(pair);
    else opponents.set(player, [pair]);
  };
  pairs.forEach((pair) => {
    add(pair.player1, pair);
    add(pair.player2, pair);
  });

  const ranked = new Map<string, string[]>();
  opponents.forEach((list, player) => {
    ranked.set(
      player,
      list
        .sort((a, b) => b.games - a.games || b.lastPlayed - a.lastPlayed)
        .map((pair) => (pair.player1 === player ? pair.player2 : pair.player1)),
    );
  });
  return ranked;
}

/** True when each player is in the top `topN` opponents of the other player. */
export function isMutualTopOpponent(ranked: Map<string, string[]>, a: string, b: string, topN: number): boolean {
  const aTop = ranked.get(a)?.slice(0, topN) ?? [];
  const bTop = ranked.get(b)?.slice(0, topN) ?? [];
  return aTop.includes(b) && bTop.includes(a);
}
