import { Elo } from "./elo";
import { Game } from "./event-store/projectors/games-projector";
import { pointToGame, setToGame } from "./future-elo-probability-lookups";
import { TennisTable } from "./tennis-table";

/**
 * Whole History Rating (Coulom, 2008).
 *
 * Every player gets a strength curve over time instead of one running number.
 * All games are fitted at once, so a result from today also sharpens the
 * estimate of who a player was months ago.
 *
 * The model is Bradley-Terry: the chance that player A beats player B is
 * sigmoid(rA - rB) on a natural log-strength scale. A Wiener process prior
 * connects each player's own time steps, so a rating moves only as far as the
 * games justify.
 *
 * The rating depends on played games only. It never reads whether a player is
 * active, so a retirement today does not change anyone's history. This is the
 * property the expected score simulation does not have.
 *
 * The scale needs one anchor, because game results alone fix only the
 * differences between players. The anchor is the prior on a player's first
 * time step: a player is expected to start at `anchorRating` points. This keeps
 * the scale comparable over time, and it defines the meaning of the numbers -
 * a rating is measured against the skill of a new player, not against the
 * current field.
 *
 * The fit reads three levels of a result: the game, the sets and the points.
 * A win by a large margin moves a rating more than a win by a small margin.
 * See `levelSlope` for why each level needs its own slope.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Elo points per unit of natural log-strength. A 400 point gap is a 10:1 win ratio. */
const ELO_PER_NATURAL = 400 / Math.LN10;

/** Largest natural-scale move one Newton step may take, to keep early sweeps stable. */
const MAX_NEWTON_STEP = 1;

/** Sweeps between two progress reports. One report per sweep is more messages than useful. */
const PROGRESS_INTERVAL = 5;

/**
 * The logistic slope of one level, so a set and a point enter the fit on their
 * own scale.
 *
 * A win fraction means something different at each level. The probability
 * lookups say that 60% of the sets is a 65% chance to win the game, while 60%
 * of the points is a 93% chance. Points at the slope of games would read a
 * dominant player as an even one, and every rating would collapse toward the
 * anchor.
 *
 * A lookup maps a win fraction at its level to the chance of winning the game.
 * Where the two players are even, that curve has slope `s`, and the level then
 * needs the slope `1 / s`: a rating gap that gives sigmoid(gap) games gives
 * sigmoid(gap / s) of the smaller units. The value comes from the lookup
 * itself, so the slopes follow the measured curves and need no separate
 * calibration.
 */
function levelSlope(probabilityLookup: number[]): number {
  return 0.02 / (probabilityLookup[51] - probabilityLookup[49]);
}

/** About 0.67. One point of set share is 1.5 points of game probability. */
export const SET_SLOPE = levelSlope(setToGame);

/** About 0.17. One point of point share is 5.8 points of game probability. */
export const POINT_SLOPE = levelSlope(pointToGame);

/**
 * How much each level counts.
 *
 * The game result decides the sign of a rating, and the sets and the points
 * refine it. The order is the same as the one the prediction code uses when it
 * combines the levels: the game first, then the sets, then the points.
 *
 * The weights are needed because a game holds one game result, about 3 sets and
 * about 60 points. At equal weights the sets and the points carry 3 times the
 * information of the result, and they then outvote it. A player who won 6 of 6
 * games by 2 sets to 1, but took 24 points against 29 in each game, measured
 * 1 035 points at equal weights. The result is a player who wins every game, so
 * a rating at the level of a new player is wrong.
 *
 * At the weights below the sets and the points together carry about as much as
 * the game result. The same player measures 1 094 points, and a win by a large
 * margin still separates clearly from a win by a small margin. Set a level to 0
 * to leave it out.
 */
export type WhrLevelWeights = {
  game: number;
  set: number;
  point: number;
};

export const GAME_LEVEL_ONLY: WhrLevelWeights = { game: 1, set: 0, point: 0 };
export const DEFAULT_LEVEL_WEIGHTS: WhrLevelWeights = { game: 1, set: 0.5, point: 0.25 };

export type WhrConfig = {
  /**
   * How much a player's skill can drift in Elo points over one day, as a
   * standard deviation.
   *
   * Measured against the real league: a fit on the first 75% of the games, used
   * to predict the last 505 games, gives a log loss of 0.4969 at 1, 0.4980 at 2,
   * 0.5047 at 4, 0.5244 at 8 and 0.5634 at 16. A lower value predicts a little
   * better, but it also flattens the curve until a real change in form no longer
   * shows. The default keeps the movement visible. Every value up to 8 still
   * predicts better than the Elo leaderboard, which scores 0.5498.
   */
  driftPerDay: number;
  /** Uncertainty in Elo points of the prior on a player's first rating. */
  newPlayerUncertainty: number;
  /** The rating a player is expected to have before any game is known. */
  anchorRating: number;
  /** How much the game, the sets and the points of a result each count. */
  levelWeights: WhrLevelWeights;
  /** Maximum number of sweeps over all players. A dense league needs a few hundred. */
  maxIterations: number;
  /** Stop early when the largest move in a sweep is below this many Elo points. */
  tolerance: number;
};

export const DEFAULT_WHR_CONFIG: WhrConfig = {
  driftPerDay: 8,
  newPlayerUncertainty: 300,
  anchorRating: Elo.INITIAL_ELO,
  levelWeights: DEFAULT_LEVEL_WEIGHTS,
  maxIterations: 400,
  tolerance: 0.01,
};

export type WhrRatingPoint = {
  /** UTC midnight of the day the games were played. */
  time: number;
  rating: number;
  /** One standard deviation of the rating, in Elo points. */
  uncertainty: number;
  /** Games this player played on this day. */
  games: number;
};

export type WhrPlayerCurve = {
  playerId: string;
  points: WhrRatingPoint[];
  totalGames: number;
};

/** How many of the rated games carry a score. Set and point data is newer than the league. */
export type WhrCoverage = {
  games: number;
  withSets: number;
  withPoints: number;
};

export type WhrResult = {
  curves: WhrPlayerCurve[];
  coverage: WhrCoverage;
  /** Sweeps actually run. */
  iterations: number;
  converged: boolean;
  config: WhrConfig;
};

/**
 * Everything one player did against one opponent on one day, counted at all
 * three levels. Counting instead of listing keeps the sweep over a long point
 * log as cheap as one binomial term.
 */
type Observation = {
  /** The opponent's fit, so the sweep reads their strength without a map lookup. */
  opponent: PlayerFit;
  opponentStep: number;
  gamesWon: number;
  gamesLost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
};

type PlayerFit = {
  id: string;
  /** UTC midnight of each day this player played, ascending. */
  days: number[];
  observations: Observation[][];
  gamesPerDay: number[];
  /** Natural-scale log-strength per day. */
  r: Float64Array;
  /** Natural-scale variance per day, filled in after the fit converges. */
  variance: Float64Array;
  totalGames: number;
};

function toDay(time: number): number {
  return Math.floor(time / DAY_MS) * DAY_MS;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export class Whr {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  compute(options?: Partial<WhrConfig>, onProgress?: (progress: number) => void): WhrResult {
    const config = { ...DEFAULT_WHR_CONFIG, ...options };

    const games = this.ratedGames();
    const coverage = Whr.coverageOf(games);
    const fits = this.buildFits(games);
    if (fits.length === 0) {
      return { curves: [], coverage, iterations: 0, converged: true, config };
    }

    // Natural-scale versions of the Elo-scale settings
    const driftVariancePerDay = Math.pow(config.driftPerDay / ELO_PER_NATURAL, 2);
    const anchorPrecision = 1 / Math.pow(config.newPlayerUncertainty / ELO_PER_NATURAL, 2);
    const toleranceNatural = config.tolerance / ELO_PER_NATURAL;

    let iterations = 0;
    let converged = false;

    for (let sweep = 0; sweep < config.maxIterations; sweep++) {
      let largestMove = 0;
      for (const fit of fits) {
        largestMove = Math.max(
          largestMove,
          this.newtonSweep(fit, driftVariancePerDay, anchorPrecision, config.levelWeights),
        );
      }
      iterations = sweep + 1;
      if (iterations % PROGRESS_INTERVAL === 0) {
        onProgress?.(iterations / config.maxIterations);
      }
      if (largestMove < toleranceNatural) {
        converged = true;
        break;
      }
    }

    for (const fit of fits) {
      this.fillVariance(fit, driftVariancePerDay, anchorPrecision, config.levelWeights);
    }
    onProgress?.(1);

    return {
      curves: fits.map((fit) => ({
        playerId: fit.id,
        totalGames: fit.totalGames,
        points: fit.days.map((day, index) => ({
          time: day,
          rating: config.anchorRating + fit.r[index] * ELO_PER_NATURAL,
          uncertainty: Math.sqrt(Math.max(fit.variance[index], 0)) * ELO_PER_NATURAL,
          games: fit.gamesPerDay[index],
        })),
      })),
      coverage,
      iterations,
      converged,
      config,
    };
  }

  /** Games where both players exist, oldest first. Retired players are included. */
  private ratedGames(): Game[] {
    const knownPlayers = new Set(this.parent.allPlayers.map((player) => player.id));
    return this.parent.games
      .filter((game) => knownPlayers.has(game.winner) && knownPlayers.has(game.loser))
      .slice()
      .sort((a, b) => a.playedAt - b.playedAt);
  }

  private static coverageOf(games: Game[]): WhrCoverage {
    let withSets = 0;
    let withPoints = 0;
    for (const game of games) {
      if (game.score) withSets++;
      if (game.score?.setPoints) withPoints++;
    }
    return { games: games.length, withSets, withPoints };
  }

  private buildFits(games: Game[]): PlayerFit[] {
    // Pass 1: the set of days each player played
    const daysByPlayer = new Map<string, Set<number>>();
    const addDay = (playerId: string, day: number) => {
      const days = daysByPlayer.get(playerId);
      if (days) {
        days.add(day);
      } else {
        daysByPlayer.set(playerId, new Set([day]));
      }
    };
    for (const game of games) {
      const day = toDay(game.playedAt);
      addDay(game.winner, day);
      addDay(game.loser, day);
    }

    // Pass 2: one fit per player, with a lookup from day to step index
    const fits = new Map<string, PlayerFit>();
    const stepIndex = new Map<string, Map<number, number>>();
    daysByPlayer.forEach((daySet, playerId) => {
      const days = Array.from(daySet).sort((a, b) => a - b);
      const indexByDay = new Map<number, number>();
      days.forEach((day, index) => indexByDay.set(day, index));
      stepIndex.set(playerId, indexByDay);
      fits.set(playerId, {
        id: playerId,
        days,
        observations: days.map(() => []),
        gamesPerDay: days.map(() => 0),
        r: new Float64Array(days.length),
        variance: new Float64Array(days.length),
        totalGames: 0,
      });
    });

    // Pass 3: count every game into one observation per opponent per day.
    // `byOpponent` finds an existing observation; it is only needed while building.
    const byOpponent = new Map<string, Map<string, Observation>[]>();
    const observationFor = (fit: PlayerFit, step: number, opponent: PlayerFit, opponentStep: number) => {
      let steps = byOpponent.get(fit.id);
      if (!steps) {
        steps = fit.days.map(() => new Map<string, Observation>());
        byOpponent.set(fit.id, steps);
      }
      const existing = steps[step].get(opponent.id);
      if (existing) return existing;

      const created: Observation = {
        opponent,
        opponentStep,
        gamesWon: 0,
        gamesLost: 0,
        setsWon: 0,
        setsLost: 0,
        pointsWon: 0,
        pointsLost: 0,
      };
      steps[step].set(opponent.id, created);
      fit.observations[step].push(created);
      return created;
    };

    for (const game of games) {
      const day = toDay(game.playedAt);
      const winner = fits.get(game.winner)!;
      const loser = fits.get(game.loser)!;
      const winnerStep = stepIndex.get(game.winner)!.get(day)!;
      const loserStep = stepIndex.get(game.loser)!.get(day)!;

      const winnerSide = observationFor(winner, winnerStep, loser, loserStep);
      const loserSide = observationFor(loser, loserStep, winner, winnerStep);

      winnerSide.gamesWon++;
      loserSide.gamesLost++;

      if (game.score) {
        winnerSide.setsWon += game.score.setsWon.gameWinner;
        winnerSide.setsLost += game.score.setsWon.gameLoser;
        loserSide.setsWon += game.score.setsWon.gameLoser;
        loserSide.setsLost += game.score.setsWon.gameWinner;
      }
      if (game.score?.setPoints) {
        let winnerPoints = 0;
        let loserPoints = 0;
        for (const set of game.score.setPoints) {
          winnerPoints += set.gameWinner;
          loserPoints += set.gameLoser;
        }
        winnerSide.pointsWon += winnerPoints;
        winnerSide.pointsLost += loserPoints;
        loserSide.pointsWon += loserPoints;
        loserSide.pointsLost += winnerPoints;
      }

      winner.gamesPerDay[winnerStep]++;
      loser.gamesPerDay[loserStep]++;
      winner.totalGames++;
      loser.totalGames++;
    }

    return Array.from(fits.values());
  }

  /**
   * Builds the gradient and the tridiagonal Hessian of the log posterior for one
   * player, then takes one Newton step. Every other player is held fixed, which
   * is what makes the whole fit a sweep over players.
   *
   * Returns the largest natural-scale move, to drive the convergence check.
   */
  private newtonSweep(
    fit: PlayerFit,
    driftVariancePerDay: number,
    anchorPrecision: number,
    levelWeights: WhrLevelWeights,
  ): number {
    const n = fit.days.length;
    const gradient = new Float64Array(n);
    const diagonal = new Float64Array(n);
    const offDiagonal = new Float64Array(Math.max(n - 1, 0));

    this.accumulate(fit, gradient, diagonal, offDiagonal, driftVariancePerDay, anchorPrecision, levelWeights);

    // The Hessian is negative definite, so solving it gives an ascent step
    const delta = this.solveTridiagonal(diagonal, offDiagonal, gradient, true);

    let largestMove = 0;
    for (let i = 0; i < n; i++) {
      const move = Math.max(Math.min(delta[i], MAX_NEWTON_STEP), -MAX_NEWTON_STEP);
      fit.r[i] += move;
      largestMove = Math.max(largestMove, Math.abs(move));
    }
    return largestMove;
  }

  /** Gradient and tridiagonal Hessian of the log posterior for one player. */
  private accumulate(
    fit: PlayerFit,
    gradient: Float64Array,
    diagonal: Float64Array,
    offDiagonal: Float64Array,
    driftVariancePerDay: number,
    anchorPrecision: number,
    levelWeights: WhrLevelWeights,
  ): void {
    const n = fit.days.length;

    // Bradley-Terry likelihood of everything played on each day
    for (let k = 0; k < n; k++) {
      const own = fit.r[k];
      for (const observation of fit.observations[k]) {
        const difference = own - observation.opponent.r[observation.opponentStep];
        Whr.addBinomial(
          gradient,
          diagonal,
          k,
          difference,
          observation.gamesWon,
          observation.gamesLost,
          1,
          levelWeights.game,
        );
        Whr.addBinomial(
          gradient,
          diagonal,
          k,
          difference,
          observation.setsWon,
          observation.setsLost,
          SET_SLOPE,
          levelWeights.set,
        );
        Whr.addBinomial(
          gradient,
          diagonal,
          k,
          difference,
          observation.pointsWon,
          observation.pointsLost,
          POINT_SLOPE,
          levelWeights.point,
        );
      }
    }

    // Anchor on the first day: a player starts at the rating of a new player.
    // This fixes the one degree of freedom that game results leave open.
    gradient[0] -= fit.r[0] * anchorPrecision;
    diagonal[0] -= anchorPrecision;

    // Wiener process prior between consecutive days
    for (let k = 0; k < n - 1; k++) {
      const days = Math.max((fit.days[k + 1] - fit.days[k]) / DAY_MS, 1);
      const precision = 1 / (driftVariancePerDay * days);
      const difference = fit.r[k + 1] - fit.r[k];
      gradient[k] += difference * precision;
      gradient[k + 1] -= difference * precision;
      diagonal[k] -= precision;
      diagonal[k + 1] -= precision;
      offDiagonal[k] += precision;
    }
  }

  /**
   * Adds one level of a result: `won` wins and `lost` losses at the same rating
   * difference. Counted as one binomial term, which is the same as one term per
   * unit and much faster over a long point log.
   *
   * The slope scales the rating difference, so the derivatives carry it through:
   * the gradient once and the second derivative twice.
   */
  private static addBinomial(
    gradient: Float64Array,
    diagonal: Float64Array,
    step: number,
    difference: number,
    won: number,
    lost: number,
    slope: number,
    weight: number,
  ): void {
    const trials = won + lost;
    if (trials === 0 || weight === 0) return;

    const expected = sigmoid(slope * difference);
    gradient[step] += weight * slope * (won - trials * expected);
    diagonal[step] -= weight * slope * slope * trials * expected * (1 - expected);
  }

  /**
   * Solves a symmetric tridiagonal system with the Thomas algorithm.
   * With `negateRhs` the solution is of `matrix * x = -rhs`.
   */
  private solveTridiagonal(
    diagonal: Float64Array,
    offDiagonal: Float64Array,
    rhs: Float64Array,
    negateRhs: boolean,
  ): Float64Array {
    const n = diagonal.length;
    const solution = new Float64Array(n);
    const sign = negateRhs ? -1 : 1;

    if (n === 1) {
      solution[0] = (sign * rhs[0]) / diagonal[0];
      return solution;
    }

    const sweptOffDiagonal = new Float64Array(n);
    const sweptRhs = new Float64Array(n);

    sweptOffDiagonal[0] = offDiagonal[0] / diagonal[0];
    sweptRhs[0] = (sign * rhs[0]) / diagonal[0];

    for (let i = 1; i < n; i++) {
      const pivot = diagonal[i] - offDiagonal[i - 1] * sweptOffDiagonal[i - 1];
      sweptOffDiagonal[i] = i < n - 1 ? offDiagonal[i] / pivot : 0;
      sweptRhs[i] = (sign * rhs[i] - offDiagonal[i - 1] * sweptRhs[i - 1]) / pivot;
    }

    solution[n - 1] = sweptRhs[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      solution[i] = sweptRhs[i] - sweptOffDiagonal[i] * solution[i + 1];
    }
    return solution;
  }

  /**
   * Fills in the variance of each day's rating from the diagonal of the inverse
   * of the negated Hessian.
   *
   * For a symmetric tridiagonal matrix a forward and a backward recursion give
   * that diagonal directly: with `forward[i]` and `backward[i]` the pivots of
   * the two sweeps, `inverse[i][i] = 1 / (forward[i] + backward[i] - a[i][i])`.
   * Both recursions use ratios only, so long curves stay numerically stable.
   */
  private fillVariance(
    fit: PlayerFit,
    driftVariancePerDay: number,
    anchorPrecision: number,
    levelWeights: WhrLevelWeights,
  ): void {
    const n = fit.days.length;
    const gradient = new Float64Array(n);
    const diagonal = new Float64Array(n);
    const offDiagonal = new Float64Array(Math.max(n - 1, 0));

    this.accumulate(fit, gradient, diagonal, offDiagonal, driftVariancePerDay, anchorPrecision, levelWeights);

    // Negate to get a positive definite matrix
    for (let i = 0; i < n; i++) diagonal[i] = -diagonal[i];
    for (let i = 0; i < offDiagonal.length; i++) offDiagonal[i] = -offDiagonal[i];

    const forward = new Float64Array(n);
    const backward = new Float64Array(n);

    forward[0] = diagonal[0];
    for (let i = 1; i < n; i++) {
      forward[i] = diagonal[i] - Math.pow(offDiagonal[i - 1], 2) / forward[i - 1];
    }

    backward[n - 1] = diagonal[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      backward[i] = diagonal[i] - Math.pow(offDiagonal[i], 2) / backward[i + 1];
    }

    for (let i = 0; i < n; i++) {
      fit.variance[i] = 1 / (forward[i] + backward[i] - diagonal[i]);
    }
  }
}
