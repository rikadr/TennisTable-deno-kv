type PlayedGame = { player1: string; player2: string };

/**
 * Returns the opponents of each player, ordered by game count, most first.
 * On a tie, the opponent with the more recent game ranks higher.
 * The games must be in chronological order.
 */
export function rankOpponents(games: PlayedGame[]): Map<string, string[]> {
  const stats = new Map<string, Map<string, { count: number; lastIndex: number }>>();

  const record = (player: string, opponent: string, index: number) => {
    let opponents = stats.get(player);
    if (!opponents) {
      opponents = new Map();
      stats.set(player, opponents);
    }
    const entry = opponents.get(opponent);
    if (entry) {
      entry.count++;
      entry.lastIndex = index;
    } else {
      opponents.set(opponent, { count: 1, lastIndex: index });
    }
  };

  games.forEach((game, index) => {
    record(game.player1, game.player2, index);
    record(game.player2, game.player1, index);
  });

  const ranked = new Map<string, string[]>();
  stats.forEach((opponents, player) => {
    ranked.set(
      player,
      Array.from(opponents.entries())
        .sort(([, a], [, b]) => b.count - a.count || b.lastIndex - a.lastIndex)
        .map(([opponent]) => opponent),
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
