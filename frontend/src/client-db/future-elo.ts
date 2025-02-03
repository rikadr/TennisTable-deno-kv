import { Elo } from "./elo";
import { TennisTable } from "./tennis-table";

const GAMES_TO_PREDICT_PER_OPONENT = 20; // Find the lowest number that gives enought games that scores tend to flat out

type Fraction = { fraction: number; confidence: number };

export class FutureElo {
  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  private parent: TennisTable;

  private playersMap = new Map<string, PlayerClass>();
  private playerPairings: { p1: string; p2: string; confidence?: number }[] = [];
  predictedGamesTemp: { winner: string; loser: string }[][] = [];
  predictedGames: { winner: string; loser: string; time: number }[] = [];

  simulate() {
    this.predictedGamesTemp = [];
    this.predictedGames = [];
    this.setup();
    this.createPredictedGames();

    const now = new Date().getTime();
    for (let i = 0; i < GAMES_TO_PREDICT_PER_OPONENT; i++) {
      for (let ii = 0; ii < this.predictedGamesTemp.length; ii++) {
        this.predictedGames.push({ ...this.predictedGamesTemp[ii][i], time: now + this.predictedGames.length });
      }
    }

    this.predictedGames = this.parent.simulations.shuffleArray(this.predictedGames);
  }

  setup() {
    // Add all existing games
    for (const { winner, loser } of this.parent.games) {
      // Add players to map
      if (this.playersMap.has(winner) === false) {
        this.playersMap.set(winner, new PlayerClass(winner));
      }
      if (this.playersMap.has(loser) === false) {
        this.playersMap.set(loser, new PlayerClass(loser));
      }
      const winnerPlayer = this.playersMap.get(winner)!;
      const loserPlayer = this.playersMap.get(loser)!;

      // Calculate elo
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(winnerPlayer.elo, loserPlayer.elo);

      // Register games
      winnerPlayer.registerGame(loser, winnersNewElo, "win");
      loserPlayer.registerGame(winner, losersNewElo, "loss");
    }

    // Create all ranked players pairings
    const rankedNames: string[] = [];
    this.playersMap.forEach(
      (player) => player.totalGames >= Elo.GAME_LIMIT_FOR_RANKED && rankedNames.push(player.name),
    );
    // Create all unique permutations of player pairings
    for (let playerIndex = 0; playerIndex < rankedNames.length; playerIndex++) {
      for (let oponentIndex = playerIndex + 1; oponentIndex < rankedNames.length; oponentIndex++) {
        this.playerPairings.push({ p1: rankedNames[playerIndex], p2: rankedNames[oponentIndex] });
      }
    }
  }

  // ------------------------------------------------------
  // Step 1: Predict future games
  // ------------------------------------------------------

  private createPredictedGames() {
    for (const { p1, p2 } of this.playerPairings) {
      const directResults = this.playersMap.get(p1)?.oponentsMap.get(p2);

      // Calculate win fraction
      const directFraction = this.getFraction(directResults?.wins, directResults?.loss);
      const oneLayerFraction = this.getOneLayerFraction(p1, p2);
      // Perhaps 2 layer fraction?
      const combinedFraction = this.combineFractions([directFraction, oneLayerFraction]);

      // Create games for wins and losses
      const predictedWins = GAMES_TO_PREDICT_PER_OPONENT * combinedFraction.fraction;
      const predictedLoss = GAMES_TO_PREDICT_PER_OPONENT * (1 - combinedFraction.fraction);

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

  // ------------------------------------------------------
  // Step 2: Shuffle games in fair order
  // ------------------------------------------------------

  private shuffleGameOrder() {
    return;
  }

  // ------------------------------------------------------
  // Step 3: Determine a probability/certainty/confidence of preditcion
  // ------------------------------------------------------

  getOneLayerFraction(p1: string, p2: string): Fraction {
    const player1 = this.playersMap.get(p1)!;
    const fractions: Fraction[] = [];

    player1.oponentsMap.forEach(({ wins, loss }, name) => {
      const p1ToIntermediaryFraction = this.getFraction(wins, loss);

      const intermediary = this.playersMap.get(name)!;
      const intermediaryToP2Results = intermediary.oponentsMap.get(p2);
      if (intermediaryToP2Results === undefined) {
        return; // Intermediary has no games against p2
      }
      const intermediaryToP2Fraction = this.getFraction(intermediaryToP2Results.wins, intermediaryToP2Results.loss);

      const linkedFraction = this.linkFractions(p1ToIntermediaryFraction, intermediaryToP2Fraction);
      fractions.push(linkedFraction);
    });

    const combinedFraction = this.combineFractions(fractions);

    return combinedFraction;
  }

  private getFraction(wins?: number, loss?: number): Fraction {
    if (wins === undefined && loss === undefined) {
      return { fraction: 0, confidence: 0 };
    }
    if (wins === undefined) wins = 0;
    if (loss === undefined) loss = 0;

    if (wins === 0 && loss === 0) {
      return { fraction: 0, confidence: 0 };
    }
    const fraction = wins / (wins + loss);

    const addition = wins + loss;
    const product = wins * loss;
    const exponents = Math.pow(2, wins * 0.5) - 1 + Math.pow(2, loss * 0.5) - 1;
    const fullexponen = Math.min(wins, loss) * product * 2;

    const confidencePoints = addition + exponents + fullexponen;
    const confidence = Math.min(confidencePoints, 100) / 100;

    return { fraction, confidence };
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

  private combineFractions(fractions: Fraction[]): Fraction {
    if (fractions.length === 0) {
      return { fraction: 0, confidence: 0 };
    }

    let weightedFractionSum = 0;
    let weightedConfidenceSum = 0;
    let totalWeight = 0;

    for (const item of fractions) {
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
}

class PlayerClass {
  constructor(name: string) {
    this.name = name;
  }

  readonly name: string;
  elo = Elo.INITIAL_ELO;
  totalGames = 0;
  oponentsMap = new Map<string, { wins: number; loss: number }>();

  registerGame(oponent: string, newElo: number, result: "win" | "loss") {
    // Find oponent
    if (this.oponentsMap.has(oponent) === false) {
      this.oponentsMap.set(oponent, { wins: 0, loss: 0 });
    }
    const oponentFromMap = this.oponentsMap.get(oponent)!;

    // Register game
    if (result === "win") {
      oponentFromMap.wins++;
    } else {
      oponentFromMap.loss++;
    }
    this.totalGames++;

    // Update elo
    this.elo = newElo;
  }
}
