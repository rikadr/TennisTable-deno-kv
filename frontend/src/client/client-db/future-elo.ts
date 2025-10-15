import { newId } from "../../common/nani-id";
import { Game } from "./event-store/projectors/games-projector";
import { gameToGame, pointToGame, setToGame } from "./future-elo-probability-lookups";
import { TennisTable } from "./tennis-table";

export type Fraction = { fraction: number; confidence: number };

export class FutureElo {
  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  private parent: TennisTable;

  GAMES_TO_PREDICT_PER_OPONENT = 20;

  playersMap = new Map<string, PlayerClass>();
  private playerPairings: { p1: string; p2: string; confidence?: number }[] = [];
  predictedGamesTemp: { winner: string; loser: string }[][] = [];
  predictedGames: Game[] = [];

  calculatePlayerFractionsForToday() {
    this.reset();
    this.setup();
    // Calculate win fraction for all player pairings
    for (const { p1, p2 } of this.playerPairings) {
      this.getDirectFraction(p1, p2, Date.now());
      this.getOneLayerFraction(p1, p2, Date.now());
      this.getTwoLayerFraction(p1, p2, Date.now());
    }
  }

  simulatedGamesForAGivenInputOfGames(games: Game[]) {
    this.reset();
    this.setup(games);
    this.createPredictedGames();
    this.shuffleGameOrder();
    const simulatedGames = [...this.predictedGames];
    this.reset();
    return simulatedGames;
  }

  private reset() {
    this.parent.leaderboard.clearCaches();
    this.parent.tournaments.clearTournamentCache();
    this.parent.individualPoints.clearCache();
    this.playersMap = new Map();
    this.playerPairings = [];
    this.predictedGamesTemp = [];
    this.predictedGames = [];
  }

  private setup(games?: Game[]) {
    // Add all existing games
    for (const game of games ?? this.parent.games) {
      const { winner, loser } = game;
      // Add players to map
      if (this.playersMap.has(winner) === false) {
        this.playersMap.set(winner, new PlayerClass(winner));
      }
      if (this.playersMap.has(loser) === false) {
        this.playersMap.set(loser, new PlayerClass(loser));
      }
      const winnerPlayer = this.playersMap.get(winner)!;
      const loserPlayer = this.playersMap.get(loser)!;

      // Register games
      winnerPlayer.registerGame(loser, "win", game);
      loserPlayer.registerGame(winner, "loss", game);
    }

    // Create all ranked players pairings
    const rankedPlayeIds: string[] = [];
    this.playersMap.forEach(
      (player) => player.totalGames >= this.parent.client.gameLimitForRanked && rankedPlayeIds.push(player.id),
    );

    // Create all unique permutations of player pairings
    for (let playerIndex = 0; playerIndex < rankedPlayeIds.length; playerIndex++) {
      for (let oponentIndex = playerIndex + 1; oponentIndex < rankedPlayeIds.length; oponentIndex++) {
        this.playerPairings.push({ p1: rankedPlayeIds[playerIndex], p2: rankedPlayeIds[oponentIndex] });
      }
    }

    // Register all oponents on all players
    this.playerPairings.forEach(({ p1, p2 }) => {
      this.playersMap.get(p1)?.registerOponentIfNotExists(p2);
      this.playersMap.get(p2)?.registerOponentIfNotExists(p1);
    });
  }

  private createPredictedGames() {
    for (const { p1, p2 } of this.playerPairings) {
      // Calculate win fraction
      const directFraction = this.getDirectFraction(p1, p2);
      const oneLayerFraction = this.getOneLayerFraction(p1, p2);
      const twoLayerFraction = this.getTwoLayerFraction(p1, p2);

      const combinedFraction = this.combinePrioritizedFractions([directFraction, oneLayerFraction, twoLayerFraction]);

      // Create games for wins and losses
      const predictedWins = this.GAMES_TO_PREDICT_PER_OPONENT * combinedFraction.fraction;
      const predictedLoss = this.GAMES_TO_PREDICT_PER_OPONENT * (1 - combinedFraction.fraction);

      const pairingGames: { winner: string; loser: string }[] = [];

      for (let i = 0; i < predictedWins; i++) {
        pairingGames.push({ winner: p1, loser: p2 });
      }
      for (let i = 0; i < predictedLoss; i++) {
        pairingGames.push({ winner: p2, loser: p1 });
      }

      this.predictedGamesTemp.push(pairingGames);

      // Update with pairing confidence
      const pairing = this.playerPairings.find((pair) => pair.p1 === p1 && pair.p2 === p2);
      if (pairing) {
        pairing.confidence = combinedFraction.confidence;
      }
    }
  }

  private shuffleGameOrder() {
    // TODO: I want a deterministic way to shuffle
    const now = new Date().getTime();
    for (let i = 0; i < this.GAMES_TO_PREDICT_PER_OPONENT; i++) {
      for (let ii = 0; ii < this.predictedGamesTemp.length; ii++) {
        this.predictedGames.push({
          ...this.predictedGamesTemp[ii][i],
          playedAt: now + this.predictedGames.length,
          id: newId(),
        });
      }
    }

    this.predictedGames = this.parent.simulations.shuffleArray(this.predictedGames);

    this.predictedGames.forEach((game, index) => (game.playedAt = now + index)); // Set deterministic time in order after shuffle
  }

  private getDirectFraction(p1: string, p2: string, ageAdjustFrom?: number): Fraction {
    const player1 = this.playersMap.get(p1);
    const player2 = this.playersMap.get(p2);

    // Check cache
    const alreadyCalculatedDirectFraction = player1?.oponentsMap.get(p2)?.directFraction;
    if (alreadyCalculatedDirectFraction) {
      return alreadyCalculatedDirectFraction;
    }

    // Calculate Fraction
    let wins = player1?.oponentsMap.get(p2)?.wins;
    let loss = player1?.oponentsMap.get(p2)?.loss;

    if (wins === undefined && loss === undefined) {
      return { fraction: 0, confidence: 0 };
    }

    const totalWins = wins?.length ?? 0;
    const totalLoss = loss?.length ?? 0;

    if (totalWins === 0 && totalLoss === 0) {
      return { fraction: 0, confidence: 0 };
    }

    const lastGameTime = Math.max(player1?.lastRegisteredGameTime ?? 0, player2?.lastRegisteredGameTime ?? 0); // TODO: Tghis will give wrong confidence for players
    const allGames = [...(wins ?? []), ...(loss ?? [])];
    const predictions: Fraction[] = [];

    // 1. Game-level prediction (all games)
    let gameWinsWeighted = 0;
    let gameLossesWeighted = 0;

    for (const game of allGames) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, ageAdjustFrom ?? lastGameTime);
      const isWin = game.winner === p1;

      if (isWin) {
        gameWinsWeighted += ageWeight;
      } else {
        gameLossesWeighted += ageWeight;
      }
    }

    if (gameWinsWeighted + gameLossesWeighted > 0) {
      const gameFraction = this.getWinFractionWithConfidence({
        wins: gameWinsWeighted,
        loss: gameLossesWeighted,
        probabilityLookup: gameToGame,
        confidenceConfig: {
          additions: 5,
          products: 1,
        },
      });
      predictions.push(gameFraction);
    }

    // 2. Set-level prediction (only games with sets)
    let setWinsWeighted = 0;
    let setLossesWeighted = 0;

    const gamesWithSets = allGames.filter((g) => g.score);
    for (const game of gamesWithSets) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, lastGameTime);
      const isWin = game.winner === p1;

      const setsWon = isWin ? game.score!.setsWon.gameWinner : game.score!.setsWon.gameLoser;
      const setsLost = isWin ? game.score!.setsWon.gameLoser : game.score!.setsWon.gameWinner;

      setWinsWeighted += setsWon * ageWeight;
      setLossesWeighted += setsLost * ageWeight;
    }

    if (setWinsWeighted + setLossesWeighted > 0) {
      const setFraction = this.getWinFractionWithConfidence({
        wins: setWinsWeighted,
        loss: setLossesWeighted,
        probabilityLookup: setToGame,
        confidenceConfig: {
          additions: 3.2,
          products: 0.4,
        },
      });

      predictions.push(setFraction);
    }

    // 3. Point-level prediction (only games with points)
    let pointWinsWeighted = 0;
    let pointLossesWeighted = 0;

    const gamesWithPoints = allGames.filter((g) => g.score?.setPoints);
    for (const game of gamesWithPoints) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, lastGameTime);
      const isWin = game.winner === p1;

      const pointsWon = game.score!.setPoints!.reduce((sum, set) => sum + (isWin ? set.gameWinner : set.gameLoser), 0);
      const pointsLost = game.score!.setPoints!.reduce((sum, set) => sum + (isWin ? set.gameLoser : set.gameWinner), 0);

      pointWinsWeighted += pointsWon * ageWeight;
      pointLossesWeighted += pointsLost * ageWeight;
    }

    if (pointWinsWeighted + pointLossesWeighted > 0) {
      const pointFraction = this.getWinFractionWithConfidence({
        wins: pointWinsWeighted,
        loss: pointLossesWeighted,
        probabilityLookup: pointToGame,
        confidenceConfig: {
          additions: 0.7,
          products: 0,
        },
      });

      predictions.push(pointFraction);
    }

    // Combine all predictions
    const { fraction, confidence } = this.combinePrioritizedFractions(predictions);

    // Update cache
    player1!.oponentsMap.get(p2)!.directFraction = { fraction, confidence };
    player2!.oponentsMap.get(p1)!.directFraction = { fraction: 1 - fraction, confidence }; // Invert fraction for p2

    return { fraction, confidence };
  }

  getDirectGameFraction(p1: string, p2: string): { fraction: Fraction; won: number; lost: number } {
    const fallback = { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0 };

    const player1 = this.playersMap.get(p1);

    let wins = player1?.oponentsMap.get(p2)?.wins;
    let loss = player1?.oponentsMap.get(p2)?.loss;

    if (wins === undefined && loss === undefined) {
      return fallback;
    }

    const totalWins = wins?.length ?? 0;
    const totalLoss = loss?.length ?? 0;

    if (totalWins === 0 && totalLoss === 0) {
      return fallback;
    }

    const allGames = [...(wins ?? []), ...(loss ?? [])];

    let gameWinsWeighted = 0;
    let gameLossesWeighted = 0;

    for (const game of allGames) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, Date.now());
      const isWin = game.winner === p1;

      if (isWin) {
        gameWinsWeighted += ageWeight;
      } else {
        gameLossesWeighted += ageWeight;
      }
    }

    if (gameWinsWeighted + gameLossesWeighted === 0) {
      return fallback;
    }

    return {
      fraction: this.getWinFractionWithConfidence({
        wins: gameWinsWeighted,
        loss: gameLossesWeighted,
        probabilityLookup: gameToGame,
        confidenceConfig: {
          additions: 5,
          products: 1,
        },
      }),
      won: totalWins,
      lost: totalLoss,
    };
  }

  getDirectSetFraction(p1: string, p2: string): { fraction: Fraction; won: number; lost: number } {
    const fallback = { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0 };

    const player1 = this.playersMap.get(p1);

    let wins = player1?.oponentsMap.get(p2)?.wins;
    let loss = player1?.oponentsMap.get(p2)?.loss;

    if (wins === undefined && loss === undefined) {
      return fallback;
    }

    const totalWins = wins?.length ?? 0;
    const totalLoss = loss?.length ?? 0;

    if (totalWins === 0 && totalLoss === 0) {
      return fallback;
    }

    const allGames = [...(wins ?? []), ...(loss ?? [])];

    let setWins = 0;
    let setLosses = 0;
    let setWinsWeighted = 0;
    let setLossesWeighted = 0;

    const gamesWithSets = allGames.filter((g) => g.score);
    for (const game of gamesWithSets) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, Date.now());
      const isWin = game.winner === p1;

      const setsWon = isWin ? game.score!.setsWon.gameWinner : game.score!.setsWon.gameLoser;
      const setsLost = isWin ? game.score!.setsWon.gameLoser : game.score!.setsWon.gameWinner;

      setWins += setsWon;
      setLosses += setsLost;
      setWinsWeighted += setsWon * ageWeight;
      setLossesWeighted += setsLost * ageWeight;
    }

    if (setWinsWeighted + setLossesWeighted === 0) {
      return fallback;
    }

    return {
      fraction: this.getWinFractionWithConfidence({
        wins: setWinsWeighted,
        loss: setLossesWeighted,
        probabilityLookup: setToGame,
        confidenceConfig: {
          additions: 3.2,
          products: 0.4,
        },
      }),
      won: setWins,
      lost: setLosses,
    };
  }

  getDirectPointFraction(p1: string, p2: string): { fraction: Fraction; won: number; lost: number } {
    const fallback = { fraction: { fraction: 0, confidence: 0 }, won: 0, lost: 0 };

    const player1 = this.playersMap.get(p1);

    let wins = player1?.oponentsMap.get(p2)?.wins;
    let loss = player1?.oponentsMap.get(p2)?.loss;

    if (wins === undefined && loss === undefined) {
      return fallback;
    }

    const totalWins = wins?.length ?? 0;
    const totalLoss = loss?.length ?? 0;

    if (totalWins === 0 && totalLoss === 0) {
      return fallback;
    }

    const allGames = [...(wins ?? []), ...(loss ?? [])];

    let pointWins = 0;
    let pointLosses = 0;
    let pointWinsWeighted = 0;
    let pointLossesWeighted = 0;

    const gamesWithPoints = allGames.filter((g) => g.score?.setPoints);
    for (const game of gamesWithPoints) {
      const ageWeight = this.ageAdjustedConfidence(1, game.playedAt, Date.now());
      const isWin = game.winner === p1;

      const pointsWon = game.score!.setPoints!.reduce((sum, set) => sum + (isWin ? set.gameWinner : set.gameLoser), 0);
      const pointsLost = game.score!.setPoints!.reduce((sum, set) => sum + (isWin ? set.gameLoser : set.gameWinner), 0);

      pointWins += pointsWon;
      pointLosses += pointsLost;
      pointWinsWeighted += pointsWon * ageWeight;
      pointLossesWeighted += pointsLost * ageWeight;
    }

    if (pointWinsWeighted + pointLossesWeighted === 0) {
      return fallback;
    }

    return {
      fraction: this.getWinFractionWithConfidence({
        wins: pointWinsWeighted,
        loss: pointLossesWeighted,
        probabilityLookup: pointToGame,
        confidenceConfig: {
          additions: 0.7,
          products: 0,
        },
      }),
      won: pointWins,
      lost: pointLosses,
    };
  }

  private getWinFractionWithConfidence(input: {
    wins: number;
    loss: number;
    probabilityLookup: number[]; // The pre-generated probability table
    confidenceConfig: {
      additions: number;
      products: number;
    };
  }): Fraction {
    const {
      wins,
      loss,
      probabilityLookup,
      confidenceConfig: { additions, products },
    } = input;

    // Calculate raw win fraction (0 to 1)
    const rawWinFraction = wins / (wins + loss);

    // Convert to continuous index (0 to 100)
    const exactIndex = rawWinFraction * 100;

    // Get the two surrounding indices
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.ceil(exactIndex);

    let expectedWinProbability = 0;

    // Handle edge cases
    if (lowerIndex === upperIndex || upperIndex > 100) {
      // Exact match or at boundary
      const index = Math.min(Math.max(Math.round(exactIndex), 0), 100);
      expectedWinProbability = probabilityLookup[index];
    } else {
      // Linear interpolation between the two closest values
      const lowerValue = probabilityLookup[lowerIndex];
      const upperValue = probabilityLookup[upperIndex];
      const fraction = exactIndex - lowerIndex; // How far between the two indices (0 to 1)

      expectedWinProbability = lowerValue + (upperValue - lowerValue) * fraction;
    }

    // Calculate confidence based on sample size
    const addition = wins + loss;
    const product = wins * loss;
    const confidencePoints = addition * additions + product * products;
    const confidence = Math.min(confidencePoints, 100) / 100;

    return {
      fraction: expectedWinProbability,
      confidence,
    };
  }

  private ageAdjustedConfidence(confidence: number, gameTime: number, referenceTime: number): number {
    const age = Math.max(referenceTime - gameTime, 0);
    const ageInDays = age / (24 * 60 * 60 * 1000);

    const halfLife = 60; // Days after which confidence is halved
    const ageAdjustmentFactor = Math.pow(2, -ageInDays / halfLife);

    return confidence * ageAdjustmentFactor;
  }

  private linkFractions(fraction1: Fraction, fraction2: Fraction): Fraction {
    const numerator = fraction1.fraction * fraction2.fraction;
    const denominator = numerator + (1 - fraction1.fraction) * (1 - fraction2.fraction);

    const fraction = denominator === 0 ? 0 : numerator / denominator;
    const confidence = fraction1.confidence * fraction2.confidence;

    return {
      fraction,
      confidence,
    };
  }

  private combineFractions(fractions: (Fraction | undefined)[]): Fraction {
    if (fractions.length === 0) {
      return { fraction: 0, confidence: 0 };
    }

    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;

    for (const item of fractions) {
      if (item === undefined) continue;
      weightedFractionSum += item.fraction * item.confidence;
      weightedConfidenceSum += item.confidence * item.confidence;
      totalWeight += item.confidence;
    }

    if (totalWeight === 0) {
      return { fraction: 0, confidence: 0 };
    }

    return {
      fraction: weightedFractionSum / totalWeight,
      confidence: weightedConfidenceSum / totalWeight,
    };
  }

  combinePrioritizedFractions(fractions: (Fraction | undefined)[]): Fraction {
    if (fractions.length === 0) {
      return { fraction: 0, confidence: 0 };
    }

    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;
    let remainingSpace = 1.0; // Start with 100% available space

    for (const item of fractions) {
      if (item === undefined || remainingSpace <= 0) continue;

      // This fraction can only contribute based on remaining space
      const contributionWeight = item.confidence * remainingSpace;

      // Add to weighted averages (same as original but with prioritized weight)
      weightedFractionSum += item.fraction * contributionWeight;
      weightedConfidenceSum += item.confidence * contributionWeight;
      totalWeight += contributionWeight;

      // Reduce remaining space for next fractions
      remainingSpace -= contributionWeight;
    }

    // Handle edge case where no fractions contributed
    if (totalWeight === 0) {
      return { fraction: 0, confidence: 0 };
    }

    return {
      fraction: weightedFractionSum / totalWeight,
      confidence: weightedConfidenceSum / totalWeight,
    };
  }

  private getOneLayerFraction(p1: string, p2: string, ageAdjustFrom?: number): Fraction {
    const player1 = this.playersMap.get(p1)!;
    const player2 = this.playersMap.get(p2)!;

    // Check cache
    const alreadyCalculatedOneLayerFraction = player1?.oponentsMap.get(p2)?.oneLayerFraction;
    if (alreadyCalculatedOneLayerFraction) {
      return alreadyCalculatedOneLayerFraction;
    }

    const fractions: Fraction[] = [];

    player1.oponentsMap.forEach((_, intermediaryName) => {
      const p1TointermediaryFraction = this.getDirectFraction(p1, intermediaryName, ageAdjustFrom);

      const intermediary = this.playersMap.get(intermediaryName)!;
      const intermediaryToP2Results = intermediary.oponentsMap.get(p2);
      if (intermediaryToP2Results === undefined) {
        return; // Intermediary2 has no games against p2. Blocks intermediary and p2 being the same player
      }
      const intermediaryToP2Fraction = this.getDirectFraction(intermediaryName, p2, ageAdjustFrom);

      const linkedFraction = this.linkFractions(p1TointermediaryFraction, intermediaryToP2Fraction);

      fractions.push(linkedFraction);
    });

    const combinedFraction = this.combineFractions(fractions);

    // Update cache
    player1!.oponentsMap.get(p2)!.oneLayerFraction = combinedFraction;
    player2!.oponentsMap.get(p1)!.oneLayerFraction = {
      fraction: 1 - combinedFraction.fraction,
      confidence: combinedFraction.confidence,
    }; // Invert fraction for p2

    return combinedFraction;
  }

  private getTwoLayerFraction(p1: string, p2: string, ageAdjustFrom?: number): Fraction {
    const player1 = this.playersMap.get(p1)!;
    const player2 = this.playersMap.get(p2)!;

    // Check cache
    const alreadyCalculatedTwoLayerFraction = player1?.oponentsMap.get(p2)?.twoLayerFraction;
    if (alreadyCalculatedTwoLayerFraction) {
      return alreadyCalculatedTwoLayerFraction;
    }
    const fractions: Fraction[] = [];

    player1.oponentsMap.forEach((_, intermediary1Name) => {
      const intermediary1 = this.playersMap.get(intermediary1Name)!;
      const p1Tointermediary1Fraction = this.getDirectFraction(p1, intermediary1Name, ageAdjustFrom);

      intermediary1.oponentsMap.forEach((_, intermediary2Name) => {
        if ([p1, p2].includes(intermediary2Name)) {
          return; // Block looping chain
        }
        const intermediary2 = this.playersMap.get(intermediary2Name)!;
        if (intermediary2.oponentsMap.has(p2) === false) {
          return; // Intermidiary 2 has no results to p2
        }
        const intermediary1Tointermediary2Fraction = this.getDirectFraction(
          intermediary1Name,
          intermediary2Name,
          ageAdjustFrom,
        );
        const intermediary2ToP2Fraction = this.getDirectFraction(intermediary2Name, p2, ageAdjustFrom);

        const step1 = this.linkFractions(p1Tointermediary1Fraction, intermediary1Tointermediary2Fraction);
        const step2 = this.linkFractions(step1, intermediary2ToP2Fraction);
        fractions.push(step2);
      });
    });

    const combinedFraction = this.combineFractions(fractions);

    // Update cache
    player1!.oponentsMap.get(p2)!.twoLayerFraction = combinedFraction;
    player2!.oponentsMap.get(p1)!.twoLayerFraction = {
      fraction: 1 - combinedFraction.fraction,
      confidence: combinedFraction.confidence,
    }; // Invert fraction for p2

    return combinedFraction;
  }
}

class PlayerClass {
  constructor(id: string) {
    this.id = id;
  }

  readonly id: string;
  totalGames = 0;
  lastRegisteredGameTime = 0;
  oponentsMap = new Map<
    string,
    {
      wins: Game[];
      loss: Game[];
      directFraction?: Fraction;
      oneLayerFraction?: Fraction;
      twoLayerFraction?: Fraction;
    }
  >();

  registerOponentIfNotExists(oponent: string) {
    if (this.oponentsMap.has(oponent) === false) {
      this.oponentsMap.set(oponent, {
        wins: [],
        loss: [],
      });
    }
  }

  registerGame(oponent: string, result: "win" | "loss", game: Game) {
    // Find oponent
    this.registerOponentIfNotExists(oponent);
    const oponentFromMap = this.oponentsMap.get(oponent)!;

    // Register game
    if (result === "win") {
      oponentFromMap.wins.push(game);
    } else {
      oponentFromMap.loss.push(game);
    }

    this.totalGames++;
    this.lastRegisteredGameTime = Math.max(this.lastRegisteredGameTime, game.playedAt);
  }
}
