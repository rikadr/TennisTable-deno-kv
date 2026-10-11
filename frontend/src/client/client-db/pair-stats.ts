import { Game } from "./event-store/projectors/games-projector";

export type ScoreStats = {
  raw: { games: number; sets: number; points: number };
  ageAdjusted: { games: number; sets: number; points: number };
};

export type Totals = { games: number; sets: number; points: number };

type PairEntry = {
  /** Games between the two players, won or lost. The entry is removed at 0 */
  gamesBetween: number;
  raw: Totals;
  /** Age-adjusted totals with each game weighted relative to the anchor time */
  anchored: Totals;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const AGE_HALF_LIFE_DAYS = 120;

const EMPTY_STATS: ScoreStats = {
  raw: { games: 0, sets: 0, points: 0 },
  ageAdjusted: { games: 0, sets: 0, points: 0 },
};

/** The number of games played at or before the time. The games must be sorted by time */
function countGamesUpTo(games: Game[], time: number): number {
  let count = games.length;
  while (count > 0 && games[count - 1].playedAt > time) count--;
  return count;
}

/**
 * The accumulated stats of each player against each opponent. The
 * age-adjusted stats can be read at any reference time without a new pass over
 * the games. `advanceTo` adds the next games, and `rewindTo` removes the latest
 * games.
 *
 * The age weight decays exponentially: 2^(-(T - t) / h) = 2^(-(A - t) / h) * 2^((A - T) / h),
 * for game time t, reference time T and anchor time A. Each game adds the first
 * factor, which does not change with T. A read multiplies by the second factor.
 *
 * A game after the anchor time counts as played at the anchor time, because the
 * age of a game is never below 0.
 */
export class PairStats {
  #anchorTime: number;
  #games: Game[];
  /** The stats hold the first `gameCount` games */
  #gameCount: number;
  /** map[playerA][playerB] = playerA's accumulated stats in all games against playerB */
  #pairs = new Map<string, Map<string, PairEntry>>();
  #opponents = new Map<string, Set<string>>();
  #factorTime: number | undefined;
  #factor = 1;

  /** The stats start with the first `gameCount` games. `advanceTo` adds the rest */
  constructor(anchorTime: number, games: Game[] = [], gameCount = games.length) {
    this.#anchorTime = anchorTime;
    this.#games = games;
    this.#gameCount = gameCount;
    this.#build();
  }

  /** The stats hold this number of games from the start of the games given to the constructor */
  get gameCount(): number {
    return this.#gameCount;
  }

  /**
   * Removes the games after the time. The games given to the constructor must
   * be sorted by time, and each call must use a time at or before the time of
   * the call before.
   *
   * A removal subtracts the weight that the game added, which leaves a small
   * rounding error. A read far before the anchor time multiplies that error, so
   * the stats are built again with a new anchor time before the factor gets
   * larger than 2.
   */
  rewindTo(time: number) {
    if (this.#anchorTime - time > AGE_HALF_LIFE_DAYS * DAY_MS) {
      this.#anchorTime = time;
      this.#gameCount = countGamesUpTo(this.#games, time);
      this.#build();
      return;
    }
    while (this.#gameCount > 0 && this.#games[this.#gameCount - 1].playedAt > time) {
      this.#update(this.#games[--this.#gameCount], -1);
    }
  }

  /**
   * Adds the games up to the time. The games given to the constructor must be
   * sorted by time, and each call must use a time at or after the time of the
   * call before.
   *
   * A game after the anchor time would count as played at the anchor time. So
   * before the stats add such a game, they move the anchor time 1 half-life
   * after the time. Adding a game subtracts nothing, so it leaves no rounding
   * error that a read can multiply.
   */
  advanceTo(time: number) {
    if (time > this.#anchorTime) this.#moveAnchorTo(time + AGE_HALF_LIFE_DAYS * DAY_MS);
    while (this.#gameCount < this.#games.length && this.#games[this.#gameCount].playedAt <= time) {
      this.#update(this.#games[this.#gameCount++], 1);
    }
  }

  /** p1's stats against p2, with the age weights at the reference time */
  getStats(p1: string, p2: string, referenceTime: number): ScoreStats {
    const entry = this.#pairs.get(p1)?.get(p2);
    if (!entry) return EMPTY_STATS;
    const factor = this.#factorAt(referenceTime);
    return {
      raw: entry.raw,
      ageAdjusted: {
        games: entry.anchored.games * factor,
        sets: entry.anchored.sets * factor,
        points: entry.anchored.points * factor,
      },
    };
  }

  /**
   * Calls the callback once for each pair, with p1 before p2 in string order. The totals are
   * relative to the anchor time: multiply them by `factor` for the age weights at the reference
   * time. This reads all pairs without an object for each read. Do not change the totals.
   */
  forEachPair(
    referenceTime: number,
    callback: (p1: string, p2: string, p1Won: Readonly<Totals>, p2Won: Readonly<Totals>, factor: number) => void,
  ) {
    const factor = this.#factorAt(referenceTime);
    for (const [p1, opponents] of this.#pairs) {
      for (const [p2, entry] of opponents) {
        if (p1 < p2) callback(p1, p2, entry.anchored, this.#pairs.get(p2)!.get(p1)!.anchored, factor);
      }
    }
  }

  /** The opponents of each player with at least 1 game */
  get opponents(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.#opponents;
  }

  /** All the games of the player, won and lost */
  getTotalGames(playerId: string): number {
    let total = 0;
    for (const entry of this.#pairs.get(playerId)?.values() ?? []) total += entry.gamesBetween;
    return total;
  }

  #build() {
    this.#pairs.clear();
    this.#opponents.clear();
    this.#factorTime = undefined;
    for (let i = 0; i < this.#gameCount; i++) this.#update(this.#games[i], 1);
  }

  /** Multiplies each age-adjusted total by the same factor, so that the weights are relative to the new anchor time */
  #moveAnchorTo(anchorTime: number) {
    const factor = Math.pow(2, (this.#anchorTime - anchorTime) / DAY_MS / AGE_HALF_LIFE_DAYS);
    for (const opponents of this.#pairs.values()) {
      for (const { anchored } of opponents.values()) {
        anchored.games *= factor;
        anchored.sets *= factor;
        anchored.points *= factor;
      }
    }
    this.#anchorTime = anchorTime;
    this.#factorTime = undefined;
  }

  #factorAt(referenceTime: number): number {
    if (this.#factorTime !== referenceTime) {
      this.#factorTime = referenceTime;
      this.#factor = Math.pow(2, (this.#anchorTime - referenceTime) / DAY_MS / AGE_HALF_LIFE_DAYS);
    }
    return this.#factor;
  }

  #update(game: Game, sign: 1 | -1) {
    const ageInDays = Math.max(this.#anchorTime - game.playedAt, 0) / DAY_MS;
    const weight = sign * Math.pow(2, -ageInDays / AGE_HALF_LIFE_DAYS);
    const winner = this.#entry(game.winner, game.loser);
    const loser = this.#entry(game.loser, game.winner);

    winner.raw.games += sign;
    winner.anchored.games += weight;
    if (game.score) {
      winner.raw.sets += sign * game.score.setsWon.gameWinner;
      winner.anchored.sets += weight * game.score.setsWon.gameWinner;
      loser.raw.sets += sign * game.score.setsWon.gameLoser;
      loser.anchored.sets += weight * game.score.setsWon.gameLoser;
    }
    if (game.score?.setPoints) {
      const winnerPoints = game.score.setPoints.reduce((sum, set) => sum + set.gameWinner, 0);
      const loserPoints = game.score.setPoints.reduce((sum, set) => sum + set.gameLoser, 0);
      winner.raw.points += sign * winnerPoints;
      winner.anchored.points += weight * winnerPoints;
      loser.raw.points += sign * loserPoints;
      loser.anchored.points += weight * loserPoints;
    }

    winner.gamesBetween += sign;
    loser.gamesBetween += sign;
    if (winner.gamesBetween === 0) {
      this.#delete(game.winner, game.loser);
      this.#delete(game.loser, game.winner);
    } else if (sign === -1) {
      PairStats.#clearRoundingErrors(winner);
      PairStats.#clearRoundingErrors(loser);
    }
  }

  /**
   * A subtracted weight can leave a small rounding error instead of 0, or a
   * value below 0. A prediction reads any total above 0 as data, so a total with
   * no games must be exactly 0. The raw totals are integers, so they have no
   * rounding errors.
   */
  static #clearRoundingErrors(entry: PairEntry) {
    for (const key of ["games", "sets", "points"] as const) {
      entry.anchored[key] = entry.raw[key] === 0 ? 0 : Math.max(entry.anchored[key], 0);
    }
  }

  #entry(p1: string, p2: string): PairEntry {
    let inner = this.#pairs.get(p1);
    if (!inner) {
      inner = new Map();
      this.#pairs.set(p1, inner);
      this.#opponents.set(p1, new Set());
    }
    let entry = inner.get(p2);
    if (!entry) {
      entry = {
        gamesBetween: 0,
        raw: { games: 0, sets: 0, points: 0 },
        anchored: { games: 0, sets: 0, points: 0 },
      };
      inner.set(p2, entry);
      this.#opponents.get(p1)!.add(p2);
    }
    return entry;
  }

  #delete(p1: string, p2: string) {
    const inner = this.#pairs.get(p1)!;
    inner.delete(p2);
    this.#opponents.get(p1)!.delete(p2);
    if (inner.size === 0) {
      this.#pairs.delete(p1);
      this.#opponents.delete(p1);
    }
  }
}
