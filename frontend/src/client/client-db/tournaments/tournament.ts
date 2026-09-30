import { ONE_WEEK } from "../../../common/time-in-ms";
import { Game } from "../event-store/projectors/games-projector";
import { SignUp, SkippedGame, TournamentConfig } from "../event-store/projectors/tournaments-projector";
import { TennisTable } from "../tennis-table";
import { TournamentBracket } from "./bracket";
import { TournamentGroupPlay } from "./group-play";
import { seededRandom } from "./seeded-random";
import { StageColumn, StageCounts, TournamentStages } from "./stage-prediction";

export type TournamentBracketSection = "winners" | "losers" | "grandFinal" | "bracketReset";

export type PendingTournamentGame = {
  player1: string;
  player2: string;
  where: "group" | "bracket";
  section?: TournamentBracketSection;
};

export type TournamentGameTarget = {
  /** Which bracket structure the target game is in. Undefined means the same (winners) bracket */
  section?: TournamentBracketSection;
  layerIndex: number;
  gameIndex: number;
  role: "player1" | "player2";
};

export type TournamentGame = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: SkippedGame;
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: TournamentGameTarget;
  /** Double elimination: the game the loser drops down to */
  loserAdvanceTo?: TournamentGameTarget;
  /** Double elimination: structural slot that will never be played (bye). Hidden in the UI */
  isBye?: boolean;
  /**
   * Double elimination: a losers bracket slot that will only ever receive one player (no
   * opponent). The lone player takes a walkover and is advanced automatically, continuing as a
   * losers bracket survivor. Shown in the UI as a walkover card, not as a playable game.
   */
  walkover?: boolean;
  /** Double elimination: which bracket structure this game belongs to. Undefined in single elimination */
  section?: TournamentBracketSection;
};

/**
 * Where one game sits inside one tournament: the group it was played in, or the bracket section
 * and the layer of it. The player slots come in the order the bracket or the group holds them, so
 * a link can point the tournament page at the game's own card.
 */
export type TournamentGamePlacement = {
  tournament: { id: string; name: string };
  player1: string;
  player2: string;
} & (
  | { where: "group"; groupIndex: number }
  | {
      where: "bracket";
      section: TournamentBracketSection;
      layerIndex: number;
      /** Layers in the game's own section. A second chance round is named by how far it is from the end */
      layerCount: number;
      doubleElimination: boolean;
    }
);

export class Tournament {
  readonly tournamentConfig: TournamentConfig;
  readonly #games: Game[];
  readonly skippedGames: SkippedGame[];
  readonly signedUp: SignUp[];
  groupPlay?: TournamentGroupPlay;
  bracket?: TournamentBracket;

  static readonly GROUP_POINTS = { WIN: 3, LOSS: 1, SKIP: 0 } as const;

  private static readonly RECENT_WINNER_THRESHOLD = 2 * ONE_WEEK;
  private static readonly SIGNUP_PERIOD = 2 * ONE_WEEK;

  /** The moment this tournament is seen from: the reference time of a projection
   * of a past state, or the real clock for the live state. Read lazily so the
   * live state always uses the current time. */
  get #time(): number {
    return this.#referenceTime ?? Date.now();
  }

  readonly #referenceTime: number | undefined;

  constructor(
    tournamentConfig: TournamentConfig,
    games: Game[],
    skippedGames: SkippedGame[],
    signedUp: SignUp[],
    referenceTime?: number,
  ) {
    this.tournamentConfig = tournamentConfig;
    this.#games = games;
    this.skippedGames = skippedGames;
    this.signedUp = signedUp;
    this.#referenceTime = referenceTime;

    if (this.tournamentConfig.startDate > this.#time) {
      return; // Not started. No need to calculate bracket or group play
    }
    if (this.tournamentConfig.groupPlay) {
      this.groupPlay = new TournamentGroupPlay(this);
    }
    if (
      this.tournamentConfig.groupPlay === false || // No group play
      this.groupPlay === undefined || // Group play is not calculated
      this.groupPlay.groupPlayEnded !== undefined // Group play has ended
    ) {
      this.bracket = new TournamentBracket(this);
    }
  }

  get id() {
    return this.tournamentConfig.id;
  }
  get name() {
    return this.tournamentConfig.name;
  }
  get description() {
    return this.tournamentConfig.description;
  }
  get startDate() {
    return this.tournamentConfig.startDate;
  }
  get endDate() {
    return this.bracket?.bracketEnded;
  }
  get winner() {
    return this.bracket?.winner;
  }

  get recentWinner(): string | undefined {
    if (this.startDate > this.#time) return undefined; // Has not started
    if (this.endDate === undefined) return undefined; // Has not ended
    if (this.winner === undefined) return undefined; // Has no winner
    if (this.#time - this.endDate > Tournament.RECENT_WINNER_THRESHOLD) return undefined; // Not recent
    return this.winner;
  }

  get inSignupPeriod(): boolean {
    if (this.startDate < this.#time) return false; // Has started
    if (this.startDate - Tournament.SIGNUP_PERIOD > this.#time) return false; // Not yet in signup period
    return true;
  }

  get hasPendingGames(): boolean {
    if (this.startDate > this.#time) return false; // Not started
    if (this.endDate !== undefined) return false; // Has ended

    // Check group play
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      return this.groupPlay.groups.some((group) => group.pending.length > 0);
    }

    // Check bracket
    return this.bracket!.hasPendingGames;
  }

  /** Used by bracket and group play to get the relevant games and skips */
  getRelevantGames(startTime: number, endTime?: number) {
    type BaseEntry = { time: number; player1: string; player2: string };
    const entries: (
      | (BaseEntry & { game: Game; skip: undefined })
      | (BaseEntry & { game: undefined; skip: SkippedGame })
    )[] = [];

    this.#games
      .filter((game) => game?.playedAt > startTime)
      .forEach((game) =>
        entries.push({ time: game.playedAt, player1: game.winner, player2: game.loser, game, skip: undefined }),
      );

    this.skippedGames
      .filter((s) => s.time > startTime)
      .forEach((skip) =>
        entries.push({ time: skip.time, player1: skip.winner, player2: skip.loser, game: undefined, skip }),
      );

    if (endTime) {
      return entries.filter((e) => e.time <= endTime).sort((a, b) => a.time - b.time);
    }

    entries.sort((a, b) => a.time - b.time); // Might be heavy sorting, but we need to be sure the games are in order
    return entries;
  }

  findPendingGame(
    player1: string,
    player2: string,
  ):
    | {
        tournament: { name: string; id: string };
        player1: string;
        player2: string;
        groupIndex?: number;
        layerIndex?: number;
        bracketSection?: TournamentBracketSection;
        doubleElimination?: boolean;
      }
    | undefined {
    if (this.startDate > this.#time) return; // Not started
    if (this.endDate !== undefined) return; // Has ended

    const players = [player1, player2];

    // Check group play games
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      const pendingGroupIndex = this.groupPlay.groups.findIndex((group) =>
        group.pending.some((game) => players.includes(game.player1!) && players.includes(game.player2!)),
      );
      const pendingGame = this.groupPlay.groups[pendingGroupIndex]?.pending.find(
        (game) => players.includes(game.player1!) && players.includes(game.player2!),
      );
      if (pendingGame) {
        return {
          tournament: { name: this.name, id: this.id },
          player1: pendingGame.player1!,
          player2: pendingGame.player2!,
          groupIndex: pendingGroupIndex,
        };
      }
    }
    if (!this.bracket) return;

    // Check bracket games (winners bracket, losers bracket, grand final)
    const pendingBracketGame = this.bracket
      .getPendingGames()
      .find(({ game }) => players.includes(game.player1!) && players.includes(game.player2!));
    if (pendingBracketGame) {
      return {
        tournament: { name: this.name, id: this.id },
        player1: pendingBracketGame.game.player1!,
        player2: pendingBracketGame.game.player2!,
        layerIndex: pendingBracketGame.layerIndex,
        bracketSection: pendingBracketGame.section,
        doubleElimination: this.bracket.doubleElimination,
      };
    }
  }

  findPendingGamesByPlayer(player: string):
    | {
        tournament: { name: string; id: string };
        games: { oponent: string; player1: string; player2: string }[];
      }
    | undefined {
    if (this.startDate > this.#time) return; // Not started
    if (this.endDate !== undefined) return; // Has ended

    const games: { oponent: string; player1: string; player2: string }[] = [];

    // Check group play games
    this.groupPlay?.groups.forEach((group) => {
      group.pending.forEach((game) => {
        if (game.player1 === player || game.player2 === player) {
          games.push({
            oponent: game.player1 === player ? game.player2! : game.player1!,
            player1: game.player1!,
            player2: game.player2!,
          });
        }
      });
    });

    // Check bracket games (winners bracket, losers bracket, grand final)
    this.bracket?.getPendingGames().forEach(({ game }) => {
      if (game.player1 === player || game.player2 === player) {
        games.push({
          oponent: game.player1 === player ? game.player2! : game.player1!,
          player1: game.player1!,
          player2: game.player2!,
        });
      }
    });

    if (games.length === 0) return;
    return {
      tournament: { name: this.name, id: this.id },
      games,
    };
  }

  /**
   * Find all pending games in the tournament
   * @returns Array of pending games with player IDs and the part of the tournament they are in
   */
  findAllPendingGames(): PendingTournamentGame[] {
    if (this.startDate > this.#time) return []; // Not started
    if (this.endDate !== undefined) return []; // Has ended

    const games: PendingTournamentGame[] = [];

    // Check group play games
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      this.groupPlay.groups.forEach((group) => {
        group.pending.forEach((game) => {
          games.push({
            player1: game.player1!,
            player2: game.player2!,
            where: "group",
          });
        });
      });
    }

    // Check bracket games (winners bracket, losers bracket, grand final)
    this.bracket?.getPendingGames().forEach(({ game, section }) => {
      games.push({
        player1: game.player1!,
        player2: game.player2!,
        where: "bracket",
        section,
      });
    });

    return games;
  }

  /**
   * Where the game played at this time sits in this tournament. A game is played once, so it holds
   * at most one place here. Two tournaments that run at the same time can each hold the same game.
   */
  findGamePlacement(playedAt: number): TournamentGamePlacement | undefined {
    const tournament = { id: this.id, name: this.name };

    const groups = this.groupPlay?.groups ?? [];
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      const game = groups[groupIndex].played.find((g) => g.completedAt === playedAt && g.skipped === undefined);
      if (game) {
        return { tournament, player1: game.player1, player2: game.player2, where: "group", groupIndex };
      }
    }

    const bracketGame = this.bracket?.findCompletedGame(playedAt);
    if (bracketGame) {
      return {
        tournament,
        player1: bracketGame.game.player1,
        player2: bracketGame.game.player2,
        where: "bracket",
        section: bracketGame.section,
        layerIndex: bracketGame.layerIndex,
        layerCount: bracketGame.layerCount,
        doubleElimination: this.bracket!.doubleElimination,
      };
    }
  }

  findAllCompletedGameTimes(): number[] {
    const times: number[] = [];
    if (this.groupPlay) {
      for (const group of this.groupPlay.groups) {
        for (const groupGame of group.groupGames) {
          groupGame.completedAt && times.push(groupGame.completedAt);
        }
      }
    }
    if (this.bracket) {
      for (const game of this.bracket.getCompletedGames()) {
        times.push(game.completedAt);
      }
    }
    times.sort((a, b) => a - b);
    return times;
  }

  /**
   * Simulates the rest of the tournament once. With a seed, the group play and the bracket each get
   * their own seeded random numbers. The same seed at two times then gives the same number to the
   * same game, so the difference between the two predictions comes from the played games.
   */
  predictWinner(
    state: TennisTable,
    time: number,
    seed?: number,
  ): { winner: string; gamesSimulatedCount: number; totalConfidenceSum: number } {
    const simulateGameFn = this.simulateGameFn(state);
    const { groupRandom, bracketRandom } = Tournament.#randoms(seed);
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      const groupPlayResult = this.groupPlay.simulatePlayerOrder(simulateGameFn, time, groupRandom);
      const bracketResult = TournamentBracket.simulateWinnerFromStatic(
        simulateGameFn,
        time,
        groupPlayResult.playerOrder,
        this.tournamentConfig.doubleElimination,
        bracketRandom,
      );
      return {
        winner: bracketResult.winner,
        gamesSimulatedCount: groupPlayResult.gamesSimulatedCount + bracketResult.gamesSimulatedCount,
        totalConfidenceSum: groupPlayResult.totalConfidenceSum + bracketResult.totalConfidenceSum,
      };
    }
    if (this.bracket && this.bracket.bracketEnded === undefined) {
      return this.bracket.simulateWinnerFromExisting(simulateGameFn, time, bracketRandom);
    }

    if (this.winner) {
      return { winner: this.winner, gamesSimulatedCount: 1, totalConfidenceSum: 1 };
    }
    throw new Error("Unexpected no winner of tournament when predicting winner");
  }

  /** Simulates the rest of the tournament once and returns the stage each player reached */
  simulateStages(state: TennisTable, time: number): TournamentStages {
    const simulateGameFn = this.simulateGameFn(state);
    const doubleElimination = this.tournamentConfig.doubleElimination;
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      const { playerOrder, standings } = this.groupPlay.simulatePlayerOrder(simulateGameFn, time);
      const stages = TournamentBracket.simulateStagesFromStatic(simulateGameFn, time, playerOrder, doubleElimination);
      return this.#addGroupStages(stages, standings, playerOrder.length);
    }
    if (this.bracket) {
      return this.#addDecidedGroupStages(this.bracket.simulateStagesFromExisting(simulateGameFn, time));
    }
    throw new Error("Cannot simulate the stages of a tournament that has not started");
  }

  /** The stages that the played games already decide */
  getDecidedStages(): TournamentStages {
    if (!this.bracket) return { players: new Map(), winnersLayerCount: 0, losersLayerCount: 0 };
    return this.#addDecidedGroupStages(this.bracket.getDecidedStages());
  }

  #addDecidedGroupStages(stages: TournamentStages): TournamentStages {
    if (!this.groupPlay) return stages;
    return this.#addGroupStages(stages, this.groupPlay.getStandings(), this.groupPlay.getBracketSize());
  }

  /** A player below the bracket places in the total group play standings leaves the tournament in the group play */
  #addGroupStages(stages: TournamentStages, standings: string[], bracketSize: number) {
    const doubleElimination = this.tournamentConfig.doubleElimination;
    standings.slice(bracketSize).forEach((player, index) => {
      const stage = `group:${bracketSize + index + 1}` as const;
      stages.players.set(player, { knockedOut: stage, firstChance: doubleElimination ? stage : undefined });
    });
    return stages;
  }

  /**
   * The chance of a win for each player and the chance of a tournament win for each player. A
   * single elimination bracket is calculated exactly. Group play and double elimination are
   * simulated once, so the caller averages the chances of many calls.
   */
  predictWinChances(state: TennisTable, time: number, seed?: number): WinChances {
    const groupPlayPending = this.groupPlay !== undefined && this.groupPlay.groupPlayEnded === undefined;
    const bracketPending = this.bracket !== undefined && this.bracket.bracketEnded === undefined;

    if (this.tournamentConfig.doubleElimination === false) {
      const predictGameFn = this.predictGameFn(state);
      if (groupPlayPending) {
        const groupPlay = this.groupPlay!.simulatePlayerOrder(
          this.simulateGameFn(state),
          time,
          Tournament.#randoms(seed).groupRandom,
        );
        const bracket = TournamentBracket.winChancesFromStatic(predictGameFn, groupPlay.playerOrder);
        return {
          chances: bracket.chances,
          method: "hybrid",
          gamesCount: groupPlay.gamesSimulatedCount + bracket.gamesCount,
          confidenceSum: groupPlay.totalConfidenceSum + bracket.confidenceSum,
        };
      }
      if (bracketPending) return { ...this.bracket!.winChancesFromExisting(predictGameFn), method: "exact" };
    }

    const { winner, gamesSimulatedCount, totalConfidenceSum } = this.predictWinner(state, time, seed);
    return {
      chances: new Map([[winner, 1]]),
      method: groupPlayPending || bracketPending ? "simulation" : "exact",
      gamesCount: gamesSimulatedCount,
      confidenceSum: totalConfidenceSum,
    };
  }

  /**
   * The chance of each stage for each player. A single elimination bracket is calculated exactly.
   * Group play and double elimination are simulated once, so the caller averages the chances of many calls.
   */
  predictStageChances(state: TennisTable, time: number): StageChances {
    const groupPlayPending = this.groupPlay !== undefined && this.groupPlay.groupPlayEnded === undefined;
    const bracketPending = this.bracket !== undefined && this.bracket.bracketEnded === undefined;

    if (this.tournamentConfig.doubleElimination === false) {
      const predictGameFn = this.predictGameFn(state);
      if (groupPlayPending) {
        const groupPlay = this.groupPlay!.simulatePlayerOrder(this.simulateGameFn(state), time);
        const bracket = TournamentBracket.stageChancesFromStatic(predictGameFn, groupPlay.playerOrder);
        const groupStages = this.#addGroupStages(
          { players: new Map(), winnersLayerCount: 0, losersLayerCount: 0 },
          groupPlay.standings,
          groupPlay.playerOrder.length,
        );
        return {
          ...Tournament.#withGroupStages(bracket.players, groupStages),
          winnersLayerCount: bracket.winnersLayerCount,
          losersLayerCount: 0,
          method: "hybrid",
        };
      }
      if (this.bracket) {
        const bracket = this.bracket.stageChancesFromExisting(predictGameFn);
        const groupStages = this.#addDecidedGroupStages({
          players: new Map(),
          winnersLayerCount: 0,
          losersLayerCount: 0,
        });
        return {
          ...Tournament.#withGroupStages(bracket.players, groupStages),
          winnersLayerCount: bracket.winnersLayerCount,
          losersLayerCount: 0,
          method: "exact",
        };
      }
    }

    const stages = this.simulateStages(state, time);
    return {
      ...Tournament.#withGroupStages(new Map(), stages),
      winnersLayerCount: stages.winnersLayerCount,
      losersLayerCount: stages.losersLayerCount,
      method: groupPlayPending || bracketPending ? "simulation" : "exact",
    };
  }

  /** Adds the stages that are certain, with a chance of 1, to the knocked out chances of the bracket */
  static #withGroupStages(knockedOut: Map<string, StageCounts>, stages: TournamentStages) {
    const players = new Map<string, Record<StageColumn, StageCounts>>();
    knockedOut.forEach((counts, player) => players.set(player, { knockedOut: counts, firstChance: {} }));
    stages.players.forEach((playerStages, player) => {
      const counts = players.get(player) ?? { knockedOut: {}, firstChance: {} };
      if (playerStages.knockedOut) counts.knockedOut[playerStages.knockedOut] = 1;
      if (playerStages.firstChance) counts.firstChance[playerStages.firstChance] = 1;
      players.set(player, counts);
    });
    return { players };
  }

  /** The chance that player1 wins a game. A pair with no prediction gets 50% and a confidence of 0 */
  predictGameFn(state: TennisTable): PredictGameFn {
    return function fn(player1: string, player2: string) {
      const fraction = state.predictions.getPredictedFraction(player1, player2);
      return fraction
        ? { player1Wins: fraction.fraction, confidence: fraction.confidence }
        : { player1Wins: 0.5, confidence: 0 };
    };
  }

  static #randoms(seed: number | undefined) {
    if (seed === undefined) return { groupRandom: Math.random, bracketRandom: Math.random };
    return { groupRandom: seededRandom(seed, 1), bracketRandom: seededRandom(seed, 2) };
  }

  simulateGameFn(state: TennisTable): SimulateGameFn {
    const predictGameFn = this.predictGameFn(state);
    return function fn(player1: string, player2: string, random: number) {
      const { player1Wins: chance, confidence } = predictGameFn(player1, player2);
      // Player 1 wins if random number is less than their predicted fraction
      const player1Wins = random < chance;

      return {
        winner: player1Wins ? player1 : player2,
        loser: player1Wins ? player2 : player1,
        confidence,
      };
    };
  }
}

/** Simulates one game. The random number is from 0 to 1 */
export type SimulateGameFn = (
  player1: string,
  player2: string,
  random: number,
) => { winner: string; loser: string; confidence: number };

export type PredictionMethod = "exact" | "hybrid" | "simulation";

/**
 * A hybrid sample calculates the bracket exactly, so it varies much less than a full simulation. On
 * real tournaments the variance of one sample was 35 to 49 times smaller. With 25 times fewer samples,
 * the noise is the same or less.
 */
export const HYBRID_SAMPLE_DIVISOR = 25;

export type PredictGameFn = (player1: string, player2: string) => { player1Wins: number; confidence: number };

export type WinChances = {
  /** The chance that each player wins the tournament. A player with no chance is left out */
  chances: Map<string, number>;
  /**
   * - exact: calculated exactly, one call is enough.
   * - hybrid: one simulation of the group play, with the bracket calculated exactly. The caller repeats it.
   * - simulation: one simulation of the whole tournament. The caller repeats it.
   */
  method: PredictionMethod;
  /** The expected number of games that the prediction plays, and the sum of their confidence */
  gamesCount: number;
  confidenceSum: number;
};

export type StageChances = {
  /** The chance of each stage for each player, in each column */
  players: Map<string, Record<StageColumn, StageCounts>>;
  winnersLayerCount: number;
  losersLayerCount: number;
  /** As for {@link WinChances} */
  method: PredictionMethod;
};
