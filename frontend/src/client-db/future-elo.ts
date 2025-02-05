import { Elo } from "./elo";
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
  predictedGames: { winner: string; loser: string; time: number }[] = [];

  simulate() {
    this.parent.leaderboard.clearCaches();
    this.playersMap = new Map();
    this.playerPairings = [];
    this.predictedGamesTemp = [];
    this.predictedGames = [];

    this.setup();
    this.createPredictedGames();
    this.shuffleGameOrder();

    this.parent.isSimulatedState = true;
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
      const { winnersNewElo, losersNewElo } = Elo.calculateELO(
        winnerPlayer.elo,
        loserPlayer.elo,
        winnerPlayer.totalGames,
        loserPlayer.totalGames,
      );

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
        this.predictedGames.push({ ...this.predictedGamesTemp[ii][i], time: now + this.predictedGames.length });
      }
    }

    this.predictedGames = this.parent.simulations.shuffleArray(this.predictedGames);
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
    if (wins === undefined) wins = 0;
    if (loss === undefined) loss = 0;

    if (wins === 0 && loss === 0) {
      return { fraction: 0, confidence: 0 };
    }
    const fraction = wins / (wins + loss);

    const addition = wins + loss;
    const product = wins * loss;
    const confidencePoints = addition * 3 + product * 6;

    const confidence = Math.min(confidencePoints, 100) / 100;

    // Update cache
    player1!.oponentsMap.get(p2)!.directFraction = { fraction, confidence };
    player2!.oponentsMap.get(p1)!.directFraction = { fraction: 1 - fraction, confidence }; // Invert fraction for p2

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
  constructor(name: string) {
    this.name = name;
  }

  readonly name: string;
  elo = Elo.INITIAL_ELO;
  totalGames = 0;
  oponentsMap = new Map<
    string,
    { wins: number; loss: number; directFraction?: Fraction; oneLayerFraction?: Fraction; twoLayerFraction?: Fraction }
  >();

  registerOponentIfNotExists(oponent: string) {
    if (this.oponentsMap.has(oponent) === false) {
      this.oponentsMap.set(oponent, {
        wins: 0,
        loss: 0,
      });
    }
  }

  registerGame(oponent: string, newElo: number, result: "win" | "loss") {
    // Find oponent
    this.registerOponentIfNotExists(oponent);
    const oponentFromMap = this.oponentsMap.get(oponent)!;

    // Register game
    if (result === "win") {
      oponentFromMap.wins++;
    } else {
      oponentFromMap.loss++;
    }

    this.totalGames++;
    this.elo = newElo;
  }
}
