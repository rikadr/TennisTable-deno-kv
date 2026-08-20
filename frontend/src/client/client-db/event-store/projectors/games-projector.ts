import { WINNER_SIDES_PATTERN } from "../../../../common/table-sides";
import { GameCreated, GameDeleted, GameScore, GameTracking } from "../event-types";
import { ValidatorResponse } from "./validator-types";

const isCount = (value: number) => Number.isInteger(value) && value >= 0;

/**
 * Checks the timing and serve data against the point log it describes. Returns
 * the error message, or undefined when the tracking data is valid.
 */
function validateTracking(tracking: GameTracking, pointSequences: string[]): string | undefined {
  if (tracking.version !== 1) {
    return `Tracking data is invalid. Unknown version ${tracking.version}`;
  }
  if (tracking.source !== "track-game" && tracking.source !== "live-game") {
    return "Tracking data is invalid. Unknown source";
  }
  if (isCount(tracking.startedAt) === false || tracking.startedAt === 0) {
    return "Tracking data is invalid. Started at must be an epoch timestamp";
  }
  if (tracking.pointDeltas.length !== pointSequences.length) {
    return "Tracking data is invalid. There must be one point delta list per set";
  }
  for (let setIndex = 0; setIndex < tracking.pointDeltas.length; setIndex++) {
    const deltas = tracking.pointDeltas[setIndex];
    if (deltas.length !== pointSequences[setIndex].length) {
      return `Tracking data is invalid. Set ${setIndex + 1} has ${deltas.length} point deltas for ${
        pointSequences[setIndex].length
      } points`;
    }
    if (deltas.some((delta) => isCount(delta) === false)) {
      return `Tracking data is invalid. Set ${setIndex + 1} has a point delta that is not a positive whole number`;
    }
  }
  if (tracking.firstServers.length !== pointSequences.length) {
    return "Tracking data is invalid. There must be one first server per set";
  }
  if (/^[WL]*$/.test(tracking.firstServers) === false) {
    return "Tracking data is invalid. Only 'W' and 'L' first servers are allowed";
  }
  // The sides of the table are optional, because a game can be tracked without
  // them. A game that has them must have one side per set.
  if (tracking.winnerSides !== undefined) {
    if (tracking.winnerSides.length !== pointSequences.length) {
      return "Tracking data is invalid. There must be one table side per set";
    }
    if (WINNER_SIDES_PATTERN.test(tracking.winnerSides) === false) {
      return "Tracking data is invalid. Only 'G', 'B' and 'N' table sides are allowed";
    }
  }
  if (isCount(tracking.endedAfter) === false) {
    return "Tracking data is invalid. Ended after must be a positive whole number";
  }
  if (isCount(tracking.corrections) === false) {
    return "Tracking data is invalid. Corrections must be a positive whole number";
  }
  return undefined;
}

export type Game = { id: string; playedAt: number; winner: string; loser: string; score?: GameScore["data"] };

export class GamesProjector {
  #gamesMap = new Map<string, Game>();

  get games(): Game[] {
    return Array.from(this.#gamesMap.values()).sort((a, b) => a.playedAt - b.playedAt);
  }

  getGameById(gameId?: string | null) {
    if (!gameId) return undefined;
    return this.#gamesMap.get(gameId);
  }

  createGame(event: GameCreated) {
    const game: Game = {
      id: event.stream,
      playedAt: event.data.playedAt,
      winner: event.data.winner,
      loser: event.data.loser,
    };
    this.#gamesMap.set(event.stream, game);
  }

  setScore(event: GameScore) {
    if (this.#gamesMap.has(event.stream)) {
      this.#gamesMap.get(event.stream)!.score = event.data;
    }
  }

  validateCreateGame(event: GameCreated): ValidatorResponse {
    if (event.data.winner === event.data.loser) {
      return { valid: false, message: "Winner and loser cannot be the same" };
    }
    const games = Array.from(this.#gamesMap.values());
    if (games.some((game) => game.id === event.stream)) {
      return { valid: false, message: "Game stream already exists" };
    }
    if (games.some((game) => game.playedAt === event.data.playedAt)) {
      return { valid: false, message: "Game played at same time" };
    }
    // Check if both players exist?
    return { valid: true };
  }

  deleteGame(event: GameDeleted) {
    this.#gamesMap.delete(event.stream);
  }

  validateDeleteGame(event: GameDeleted): ValidatorResponse {
    if (this.#gamesMap.has(event.stream) === false) {
      return { valid: false, message: "Game does not exist" };
    }
    return { valid: true };
  }

  validateScoreGame(event: GameScore): ValidatorResponse {
    if (event.data.setsWon.gameWinner <= event.data.setsWon.gameLoser) {
      return { valid: false, message: "Winner must win more sets than loser" };
    }

    if (event.data.setPoints && event.data.setPoints.every((set) => set.gameWinner === 0 && set.gameLoser === 0)) {
      return {
        valid: false,
        message: "If no points are recorded, the setPoints should not be included in the event data",
      };
    }

    if (event.data.setPoints && event.data.setPoints.some((set) => set.gameWinner === set.gameLoser)) {
      return { valid: false, message: "Points are invalid. No sets can be tied" };
    }

    const gameWinnerSetPointsWins = event.data.setPoints?.reduce((wins, set) => {
      if (set.gameWinner > set.gameLoser) wins++;
      return wins;
    }, 0);
    const gameLoserSetPointsWins = event.data.setPoints?.reduce((wins, set) => {
      if (set.gameLoser > set.gameWinner) wins++;
      return wins;
    }, 0);

    if (gameWinnerSetPointsWins !== undefined && gameLoserSetPointsWins !== undefined) {
      if (gameWinnerSetPointsWins <= gameLoserSetPointsWins) {
        return { valid: false, message: "Points are invalid. Winner must win more sets than loser" };
      }
      if (gameWinnerSetPointsWins !== event.data.setsWon.gameWinner) {
        return { valid: false, message: "Points are invalid. Winner must win the correct amount of sets" };
      }
      if (gameLoserSetPointsWins !== event.data.setsWon.gameLoser) {
        return { valid: false, message: "Points are invalid. Loser must win the correct amount of sets" };
      }
    }

    if (event.data.pointSequences && !event.data.tracking) {
      return { valid: false, message: "Point sequences require tracking data" };
    }
    if (event.data.tracking && !event.data.pointSequences) {
      return { valid: false, message: "Tracking data requires point sequences" };
    }

    if (event.data.pointSequences) {
      if (!event.data.setPoints) {
        return { valid: false, message: "Point sequences require set points" };
      }
      if (event.data.pointSequences.length !== event.data.setPoints.length) {
        return { valid: false, message: "Point sequences are invalid. There must be one sequence per set" };
      }
      for (let setIndex = 0; setIndex < event.data.pointSequences.length; setIndex++) {
        const sequence = event.data.pointSequences[setIndex];
        if (/^[WL]*$/.test(sequence) === false) {
          return { valid: false, message: "Point sequences are invalid. Only 'W' and 'L' points are allowed" };
        }
        const winnerPoints = sequence.split("").filter((point) => point === "W").length;
        const loserPoints = sequence.length - winnerPoints;
        const set = event.data.setPoints[setIndex];
        if (winnerPoints !== set.gameWinner || loserPoints !== set.gameLoser) {
          return {
            valid: false,
            message: `Point sequences are invalid. Sequence for set ${setIndex + 1} does not match the set points`,
          };
        }
      }
    }

    if (event.data.tracking && event.data.pointSequences) {
      const trackingError = validateTracking(event.data.tracking, event.data.pointSequences);
      if (trackingError) {
        return { valid: false, message: trackingError };
      }
    }

    return { valid: true };
  }
}
