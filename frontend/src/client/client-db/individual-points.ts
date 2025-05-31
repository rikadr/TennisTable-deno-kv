import { Elo } from "./elo";
import { TennisTable } from "./tennis-table";

export class IndividualPoints {
  private parent: TennisTable;
  #playerMapCache: { transactionOrder: "FIFO" | "LIFO"; map: Map<string, PlayerWithIndividualPoints> } | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  clearCache() {
    this.#playerMapCache = undefined;
  }

  get cachedTransactionOrder() {
    return this.#playerMapCache?.transactionOrder;
  }

  playerMap(transactionOrder?: "FIFO" | "LIFO"): Map<string, PlayerWithIndividualPoints> {
    if (this.#playerMapCache && transactionOrder === this.#playerMapCache.transactionOrder) {
      return this.#playerMapCache.map;
    }
    if (this.#playerMapCache && transactionOrder === undefined) {
      return this.#playerMapCache.map;
    }
    transactionOrder = transactionOrder ?? this.#playerMapCache?.transactionOrder ?? "FIFO";
    const map = this.#generatePlayerMap(transactionOrder);
    this.#playerMapCache = { transactionOrder, map };
    return map;
  }

  #generatePlayerMap(transactionOrder: "FIFO" | "LIFO") {
    const map = new Map<string, PlayerWithIndividualPoints>();
    for (const game of [...this.parent.games, ...this.parent.futureElo.predictedGames]) {
      if (
        !this.parent.eventStore.playersProjector.getPlayer(game.winner)?.active ||
        !this.parent.eventStore.playersProjector.getPlayer(game.loser)?.active
      ) {
        continue; // Skip games with inactive players
      }
      const winner = this.#getOrCreatePlayer(game.winner, map, game.playedAt);
      const loser = this.#getOrCreatePlayer(game.loser, map, game.playedAt);
      const { losersNewElo } = Elo.calculateELO(winner.totalPoints, loser.totalPoints);

      const pointsExcanged =
        transactionOrder === "FIFO"
          ? loser.losePointsFIFO(loser.totalPoints - losersNewElo, winner.id, game.playedAt)
          : loser.losePointsLIFO(loser.totalPoints - losersNewElo, winner.id, game.playedAt);
      winner.winPoints(pointsExcanged);
    }
    return map;
  }

  #getOrCreatePlayer(
    playerId: string,
    map: Map<string, PlayerWithIndividualPoints>,
    time: number,
  ): PlayerWithIndividualPoints {
    if (map.has(playerId) === false) {
      map.set(playerId, new PlayerWithIndividualPoints(playerId, time));
    }
    return map.get(playerId)!;
  }

  playerOverview(playerId: string, transactionOrder: "FIFO" | "LIFO"): { playerId: string; points: PointsRange[] }[] {
    const players: { playerId: string; points: PointsRange[] }[] = [];

    this.playerMap(transactionOrder).forEach((oponent) => {
      const playersPoints = oponent.pointsRanges.filter((range) => range.originPlayerId === playerId);
      if (playersPoints.length === 0) return;
    });

    return players;
  }
}

export type PointsRange = {
  originPlayerId: string;
  from: number;
  to: number;
  transactions: { recieverPlayerId: string; time: number }[];
};

export class PlayerWithIndividualPoints {
  constructor(id: string, time: number) {
    this.id = id;
    this.pointsRanges = [
      { originPlayerId: id, from: 0, to: Elo.INITIAL_ELO, transactions: [{ recieverPlayerId: id, time }] },
    ];
  }
  readonly id: string;
  pointsRanges: PointsRange[];

  get totalPoints() {
    return this.pointsRanges.reduce((total, range) => (total += range.to - range.from), 0);
  }

  losePointsFIFO(pointsToLose: number, recieverPlayerId: string, time: number): PointsRange[] {
    if (pointsToLose > this.totalPoints) {
      throw Error(
        `${this.id} does not have enough points to lose. Has ${this.totalPoints}, needs to lose ${pointsToLose}`,
      );
    }

    const rangesToGiveToWinner: PointsRange[] = [];
    let remainingPointsToCarveOut = pointsToLose;

    while (remainingPointsToCarveOut > 0) {
      const firstRange = this.pointsRanges.shift()!;
      const pointsInRange = firstRange.to - firstRange.from;

      if (pointsInRange <= remainingPointsToCarveOut) {
        // Give whole range
        rangesToGiveToWinner.push({
          ...firstRange,
          transactions: [...firstRange.transactions, { recieverPlayerId, time }],
        });
        remainingPointsToCarveOut -= pointsInRange;
      } else {
        // Split range and keep some of it
        const carveOutGive: PointsRange = {
          originPlayerId: firstRange.originPlayerId,
          from: firstRange.from,
          to: firstRange.from + remainingPointsToCarveOut,
          transactions: [...firstRange.transactions, { recieverPlayerId, time }],
        };
        const carveOutKeep: PointsRange = {
          originPlayerId: firstRange.originPlayerId,
          from: firstRange.from + remainingPointsToCarveOut,
          to: firstRange.to,
          transactions: firstRange.transactions,
        };
        rangesToGiveToWinner.push(carveOutGive);
        this.pointsRanges.unshift(carveOutKeep);
        remainingPointsToCarveOut -= pointsInRange;
      }
    }

    return rangesToGiveToWinner;
  }
  losePointsLIFO(pointsToLose: number, recieverPlayerId: string, time: number): PointsRange[] {
    if (pointsToLose > this.totalPoints) {
      throw Error(
        `${this.id} does not have enough points to lose. Has ${this.totalPoints}, needs to lose ${pointsToLose}`,
      );
    }

    const rangesToGiveToWinner: PointsRange[] = [];
    let remainingPointsToCarveOut = pointsToLose;

    while (remainingPointsToCarveOut > 0) {
      const lastRange = this.pointsRanges.pop()!;
      const pointsInRange = lastRange.to - lastRange.from;

      if (pointsInRange <= remainingPointsToCarveOut) {
        // Give whole range
        rangesToGiveToWinner.unshift({
          ...lastRange,
          transactions: [...lastRange.transactions, { recieverPlayerId, time }],
        });
        remainingPointsToCarveOut -= pointsInRange;
      } else {
        // Split range and keep some of it
        const carveOutKeep: PointsRange = {
          originPlayerId: lastRange.originPlayerId,
          from: lastRange.from,
          to: lastRange.to - remainingPointsToCarveOut,
          transactions: lastRange.transactions,
        };
        const carveOutGive: PointsRange = {
          originPlayerId: lastRange.originPlayerId,
          from: lastRange.to - remainingPointsToCarveOut,
          to: lastRange.to,
          transactions: [...lastRange.transactions, { recieverPlayerId, time }],
        };
        rangesToGiveToWinner.unshift(carveOutGive);
        this.pointsRanges.push(carveOutKeep);
        remainingPointsToCarveOut -= pointsInRange;
      }
    }
    return rangesToGiveToWinner;
  }

  winPoints(pointsWon: PointsRange[]) {
    for (const range of pointsWon) {
      this.pointsRanges.push(range);
    }
  }
}
