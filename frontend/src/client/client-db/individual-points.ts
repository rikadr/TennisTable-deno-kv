import { Elo } from "./elo";
import { TennisTable } from "./tennis-table";

export class IndividualPoints {
  private parent: TennisTable;
  playerMapCache: Map<string, PlayerWithIndividualPoints> | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  playerMap(): Map<string, PlayerWithIndividualPoints> {
    if (this.playerMapCache) {
      return this.playerMapCache;
    }
    const map = this.#generatePlayerMap();
    console.log({ map });

    this.playerMapCache = map;
    return map;
  }

  #generatePlayerMap() {
    const map = new Map<string, PlayerWithIndividualPoints>();
    for (const game of [...this.parent.games, ...this.parent.futureElo.predictedGames]) {
      if (
        !this.parent.eventStore.playersProjector.getPlayer(game.winner)?.active ||
        !this.parent.eventStore.playersProjector.getPlayer(game.loser)?.active
      ) {
        continue; // Skip games with inactive players
      }
      const winner = this.#getOrCreatePlayer(game.winner, map);
      const loser = this.#getOrCreatePlayer(game.loser, map);
      const { losersNewElo } = Elo.calculateELO(winner.totalPoints, loser.totalPoints);

      const pointsExcanged = loser.losePointsFIFO(loser.totalPoints - losersNewElo);
      winner.winPoints(pointsExcanged);
    }
    return map;
  }

  #getOrCreatePlayer(playerId: string, map: Map<string, PlayerWithIndividualPoints>): PlayerWithIndividualPoints {
    if (map.has(playerId) === false) {
      map.set(playerId, new PlayerWithIndividualPoints(playerId));
    }
    return map.get(playerId)!;
  }

  playerOverview(playerId: string): { playerId: string; points: PointsRange[] }[] {
    const players: { playerId: string; points: PointsRange[] }[] = [];

    this.playerMap().forEach((oponent) => {
      const playersPoints = oponent.pointsRanges.filter((range) => range.originPlayerId === playerId);
      if (playersPoints.length === 0) return;
    });

    return players;
  }
}

export type PointsRange = { originPlayerId: string; from: number; to: number };

export class PlayerWithIndividualPoints {
  constructor(id: string) {
    this.id = id;
    this.pointsRanges = [{ originPlayerId: id, from: 0, to: Elo.INITIAL_ELO }];
  }
  readonly id: string;
  pointsRanges: PointsRange[];

  get totalPoints() {
    return this.pointsRanges.reduce((total, range) => (total += range.to - range.from), 0);
  }

  losePointsFIFO(pointsToLose: number): PointsRange[] {
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
        rangesToGiveToWinner.push(firstRange);
        remainingPointsToCarveOut -= pointsInRange;
      } else {
        // Split range and keep some of it
        const carveOutGive: PointsRange = {
          originPlayerId: firstRange.originPlayerId,
          from: firstRange.from,
          to: firstRange.from + remainingPointsToCarveOut,
        };
        const carveOutKeep: PointsRange = {
          originPlayerId: firstRange.originPlayerId,
          from: firstRange.from + remainingPointsToCarveOut,
          to: firstRange.to,
        };
        rangesToGiveToWinner.push(carveOutGive);
        this.pointsRanges.unshift(carveOutKeep);
        remainingPointsToCarveOut -= pointsInRange;
      }
    }

    return rangesToGiveToWinner;
  }
  losePointsLIFO(): PointsRange[] {
    throw Error("Not implememted");
  }
  winPoints(pointsWon: PointsRange[]) {
    for (const range of pointsWon) {
      this.pointsRanges.push(range);
    }
  }
}
