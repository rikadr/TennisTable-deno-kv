import { newId } from "../../common/nani-id";
import { Game } from "./event-store/projectors/games-projector";
import { TennisTable } from "./tennis-table";

type Fraction = { fraction: number; confidence: number };

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

  simulate() {
    this.reset();
    this.setup();
    this.createPredictedGames();
    this.shuffleGameOrder();

    this.parent.isSimulatedState = true;
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
    this.parent.isSimulatedState = false;
  }

  setup(games?: Game[]) {
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

      const combinedFraction = this.combineFractions([directFraction, oneLayerFraction, twoLayerFraction]);

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

  private getDirectFraction(p1: string, p2: string): Fraction {
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

    const lastGameTime = Math.max(player1?.lastRegisteredGameTime ?? 0, player2?.lastRegisteredGameTime ?? 0);
    const allGames = [...(wins ?? []), ...(loss ?? [])];
    const allGamesIndividualFractions: Fraction[] = [];

    const TIME_WINDOW = 60 * 24 * 60 * 60 * 1000; // 60 days

    for (const game of allGames) {
      let gamePrediction: Fraction;
      const windowStart = game.playedAt - TIME_WINDOW;
      const windowEnd = game.playedAt;

      if (game.score?.setPoints) {
        // Game has point data - pool with other games that have point data
        const gamesWithPoints = allGames.filter(
          (g) => g.score?.setPoints && g.playedAt >= windowStart && g.playedAt <= windowEnd,
        );

        let totalPointsWon = 0;
        let totalPointsLost = 0;

        for (const g of gamesWithPoints) {
          const gameIsWin = g.winner === p1;
          totalPointsWon += g.score!.setPoints!.reduce(
            (sum, set) => sum + (gameIsWin ? set.gameWinner : set.gameLoser),
            0,
          );
          totalPointsLost += g.score!.setPoints!.reduce(
            (sum, set) => sum + (gameIsWin ? set.gameLoser : set.gameWinner),
            0,
          );
        }

        const pointFraction = this.getWinFractionWithConfidence({
          wins: totalPointsWon,
          loss: totalPointsLost,
          additions: 1,
          products: 0.1,
        });

        gamePrediction = {
          fraction: this.convertPointWinToGameWin(pointFraction.fraction),
          confidence: pointFraction.confidence,
        };
      } else if (game.score) {
        // Game has set data - pool with games that have at least set data
        const gamesWithSets = allGames.filter((g) => g.score && g.playedAt >= windowStart && g.playedAt <= windowEnd);

        let totalSetsWon = 0;
        let totalSetsLost = 0;

        for (const g of gamesWithSets) {
          const gameIsWin = g.winner === p1;
          totalSetsWon += gameIsWin ? g.score!.setsWon.gameWinner : g.score!.setsWon.gameLoser;
          totalSetsLost += gameIsWin ? g.score!.setsWon.gameLoser : g.score!.setsWon.gameWinner;
        }

        const setFraction = this.getWinFractionWithConfidence({
          wins: totalSetsWon,
          loss: totalSetsLost,
          additions: 3,
          products: 0.5,
        });

        gamePrediction = {
          fraction: this.convertSetWinToGameWin(setFraction.fraction),
          confidence: setFraction.confidence,
        };
      } else {
        // No score data - pool with all games in window
        const gamesInWindow = allGames.filter((g) => g.playedAt >= windowStart && g.playedAt <= windowEnd);

        const windowWins = gamesInWindow.filter((g) => g.winner === p1).length;
        const windowLosses = gamesInWindow.length - windowWins;

        const pooledFraction = this.getWinFractionWithConfidence({
          wins: windowWins,
          loss: windowLosses,
          additions: 3,
          products: 1,
        });

        gamePrediction = {
          fraction: pooledFraction.fraction,
          confidence: pooledFraction.confidence,
        };
      }

      // Apply age adjustment to all games
      gamePrediction.confidence = this.ageAdjustedConfidence(gamePrediction.confidence, game.playedAt, lastGameTime);

      allGamesIndividualFractions.push(gamePrediction);
    }

    const { fraction, confidence } = this.combineFractions(allGamesIndividualFractions);

    // Update cache
    player1!.oponentsMap.get(p2)!.directFraction = { fraction, confidence };
    player2!.oponentsMap.get(p1)!.directFraction = { fraction: 1 - fraction, confidence }; // Invert fraction for p2

    return { fraction, confidence };
  }

  private getWinFractionWithConfidence(input: {
    wins: number;
    loss: number;
    additions: number;
    products: number;
  }): Fraction {
    const { wins, loss, additions, products } = input;
    const winFraction = wins / (wins + loss);

    const addition = wins + loss;
    const product = wins * loss;
    const confidencePoints = addition * additions + product * products;

    const confidence = Math.min(confidencePoints, 100) / 100;
    return { fraction: winFraction, confidence };
  }

  private ageAdjustedConfidence(confidence: number, gameTime: number, referenceTime: number): number {
    const age = Math.max(referenceTime - gameTime, 0);
    const ageInDays = age / (24 * 60 * 60 * 1000);

    const halfLife = 45; // Days after which confidence is halved
    const ageAdjustmentFactor = Math.pow(2, -ageInDays / halfLife);

    return confidence * ageAdjustmentFactor;
  }

  private convertSetWinToGameWin(setWinRate: number): number {
    const steepness = 1.6;
    const x = setWinRate;

    // Avoid division by zero at endpoints
    if (x === 0) return 0;
    if (x === 1) return 1;

    const xPow = Math.pow(x, steepness);
    const oneMinusXPow = Math.pow(1 - x, steepness);

    return xPow / (xPow + oneMinusXPow);
  }

  private convertPointWinToGameWin(pointWinRate: number): number {
    const steepness = 6.2;
    const x = pointWinRate;

    // Avoid division by zero at endpoints
    if (x === 0) return 0;
    if (x === 1) return 1;

    const xPow = Math.pow(x, steepness);
    const oneMinusXPow = Math.pow(1 - x, steepness);

    return xPow / (xPow + oneMinusXPow);
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

  combineFractions(fractions: (Fraction | undefined)[]): Fraction {
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

  getOneLayerFraction(p1: string, p2: string): Fraction {
    const player1 = this.playersMap.get(p1)!;
    const player2 = this.playersMap.get(p2)!;

    // Check cache
    const alreadyCalculatedOneLayerFraction = player1?.oponentsMap.get(p2)?.oneLayerFraction;
    if (alreadyCalculatedOneLayerFraction) {
      return alreadyCalculatedOneLayerFraction;
    }

    const fractions: Fraction[] = [];

    player1.oponentsMap.forEach((_, intermediaryName) => {
      const p1TointermediaryFraction = this.getDirectFraction(p1, intermediaryName);

      const intermediary = this.playersMap.get(intermediaryName)!;
      const intermediaryToP2Results = intermediary.oponentsMap.get(p2);
      if (intermediaryToP2Results === undefined) {
        return; // Intermediary2 has no games against p2. Blocks intermediary and p2 being the same player
      }
      const intermediaryToP2Fraction = this.getDirectFraction(intermediaryName, p2);

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

  getTwoLayerFraction(p1: string, p2: string): Fraction {
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
      const p1Tointermediary1Fraction = this.getDirectFraction(p1, intermediary1Name);

      intermediary1.oponentsMap.forEach((_, intermediary2Name) => {
        if ([p1, p2].includes(intermediary2Name)) {
          return; // Block looping chain
        }
        const intermediary2 = this.playersMap.get(intermediary2Name)!;
        if (intermediary2.oponentsMap.has(p2) === false) {
          return; // Intermidiary 2 has no results to p2
        }
        const intermediary1Tointermediary2Fraction = this.getDirectFraction(intermediary1Name, intermediary2Name);
        const intermediary2ToP2Fraction = this.getDirectFraction(intermediary2Name, p2);

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
