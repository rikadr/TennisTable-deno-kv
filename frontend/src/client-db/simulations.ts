import { Elo } from "./elo";
import { FutureElo } from "./future-elo";
import { TennisTable } from "./tennis-table";

export class Simulations {
  private parent: TennisTable;
  futureElo: FutureElo;

  constructor(parent: TennisTable) {
    this.parent = parent;
    this.futureElo = new FutureElo(parent);
  }

  expectedWinLoss(diffElo: number, gamesToSimulate: number = 1_000): number {
    let player1Elo = 1_000;
    let player2Elo = player1Elo + diffElo;
    let wins = 0;
    let loss = 0;

    for (let i = 1; i <= gamesToSimulate; i++) {
      const player1mustWin = player2Elo - player1Elo > diffElo;
      if (player1mustWin) {
        wins++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player1Elo, player2Elo);
        player1Elo = winnersNewElo;
        player2Elo = losersNewElo;
      } else {
        loss++;
        const { winnersNewElo, losersNewElo } = Elo.calculateELO(player2Elo, player1Elo);
        player1Elo = losersNewElo;
        player2Elo = winnersNewElo;
      }
    }
    return wins / (loss ?? 1);
  }

  monteCarloSimulation(permutations: number) {
    const totalsMap: Map<string, number[]> = new Map();

    for (let i = 0; i < permutations; i++) {
      const randomizedGames = this.shuffleArray([...this.parent.games]);

      const permutationResult = Elo.eloCalculator(randomizedGames, this.parent.players);
      permutationResult.forEach(({ name, elo }) => {
        if (!totalsMap.has(name)) {
          totalsMap.set(name, [elo]);
        }
        totalsMap.get(name)!.push(elo);
      });
    }

    const simulationResult: Map<string, { avg: number; min: number; max: number }> = new Map();
    totalsMap.forEach((elos, name) => {
      const avg = elos.reduce((acc, cur) => acc + cur, 0) / elos.length;
      const minMax = { min: 9999, max: 0 };
      for (const elo of elos) {
        if (elo < minMax.min) {
          minMax.min = elo;
        }
        if (elo > minMax.max) {
          minMax.max = elo;
        }
      }
      simulationResult.set(name, { avg, ...minMax });
    });

    return Array.from(simulationResult)
      .map(([name, elo]) => ({ name, elo }))
      .sort((a, b) => b.elo.avg - a.elo.avg);
  }

  // Fisher-Yates Shuffle
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // Random index from 0 to i
      [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
  }
}
