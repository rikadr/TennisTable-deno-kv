import { expectInvalid } from "../../event-store/projectors/validator-test-utils";
import { GamesProjector } from "../../event-store/projectors/games-projector";
import { EventTypeEnum, GameCreated, GameDeleted, GameScore } from "../../event-store/event-types";

function createEvent(stream: string, playedAt: number, winner: string, loser: string): GameCreated {
  return { time: playedAt, stream, type: EventTypeEnum.GAME_CREATED, data: { playedAt, winner, loser } };
}

function deleteEvent(stream: string, time = 9000): GameDeleted {
  return { time, stream, type: EventTypeEnum.GAME_DELETED, data: null };
}

function scoreEvent(stream: string, data: GameScore["data"], time = 9500): GameScore {
  return { time, stream, type: EventTypeEnum.GAME_SCORE, data };
}

describe("GamesProjector projection", () => {
  it("creates a game from a GAME_CREATED event", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));

    expect(projector.getGameById("game-1")).toEqual({
      id: "game-1",
      playedAt: 1000,
      winner: "player-1",
      loser: "player-2",
    });
  });

  it("sorts games by playedAt regardless of insertion order", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-2", 2000, "player-1", "player-2"));
    projector.createGame(createEvent("game-1", 1000, "player-2", "player-1"));

    expect(projector.games.map((game) => game.id)).toEqual(["game-1", "game-2"]);
  });

  it("returns undefined for unknown, null or undefined game ids", () => {
    const projector = new GamesProjector();
    expect(projector.getGameById("nope")).toBeUndefined();
    expect(projector.getGameById(null)).toBeUndefined();
    expect(projector.getGameById(undefined)).toBeUndefined();
  });

  it("removes a game on GAME_DELETED", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));
    projector.deleteGame(deleteEvent("game-1"));

    expect(projector.getGameById("game-1")).toBeUndefined();
    expect(projector.games).toHaveLength(0);
  });

  it("attaches a score to an existing game and ignores scores for unknown games", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));
    const score: GameScore["data"] = { setsWon: { gameWinner: 2, gameLoser: 0 } };

    projector.setScore(scoreEvent("game-1", score));
    expect(projector.getGameById("game-1")!.score).toEqual(score);

    // No game with this stream: projection is a no-op
    projector.setScore(scoreEvent("game-2", score));
    expect(projector.getGameById("game-2")).toBeUndefined();
  });
});

describe("validateCreateGame", () => {
  it("accepts a valid game", () => {
    const projector = new GamesProjector();
    expect(projector.validateCreateGame(createEvent("game-1", 1000, "player-1", "player-2"))).toEqual({
      valid: true,
    });
  });

  it("rejects a game where the winner and loser are the same", () => {
    const projector = new GamesProjector();
    const result = projector.validateCreateGame(createEvent("game-1", 1000, "player-1", "player-1"));
    expectInvalid(result);
    expect(result.message).toBe("Winner and loser cannot be the same");
  });

  it("rejects a duplicate game stream", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));

    const result = projector.validateCreateGame(createEvent("game-1", 2000, "player-1", "player-2"));
    expectInvalid(result);
    expect(result.message).toBe("Game stream already exists");
  });

  it("rejects a game played at the exact same time as an existing game", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));

    const result = projector.validateCreateGame(createEvent("game-2", 1000, "player-3", "player-4"));
    expectInvalid(result);
    expect(result.message).toBe("Game played at same time");
  });

  it("currently does not verify that the players exist (documented gap)", () => {
    // The projector has no player knowledge; the production code carries a
    // "Check if both players exist?" comment. Documenting current behavior.
    const projector = new GamesProjector();
    expect(projector.validateCreateGame(createEvent("game-1", 1000, "ghost-a", "ghost-b"))).toEqual({
      valid: true,
    });
  });
});

describe("validateDeleteGame", () => {
  it("accepts deleting an existing game", () => {
    const projector = new GamesProjector();
    projector.createGame(createEvent("game-1", 1000, "player-1", "player-2"));
    expect(projector.validateDeleteGame(deleteEvent("game-1"))).toEqual({ valid: true });
  });

  it("rejects deleting an unknown game", () => {
    const projector = new GamesProjector();
    const result = projector.validateDeleteGame(deleteEvent("nope"));
    expectInvalid(result);
    expect(result.message).toBe("Game does not exist");
  });
});

describe("validateScoreGame", () => {
  const projector = new GamesProjector();

  it("accepts a consistent score with set points", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 11, gameLoser: 9 },
          { gameWinner: 9, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 7 },
        ],
      }),
    );
    expect(result).toEqual({ valid: true });
  });

  it("accepts a score without set points", () => {
    expect(projector.validateScoreGame(scoreEvent("game-1", { setsWon: { gameWinner: 3, gameLoser: 0 } }))).toEqual({
      valid: true,
    });
  });

  it("rejects a score where the winner does not win more sets", () => {
    const result = projector.validateScoreGame(scoreEvent("game-1", { setsWon: { gameWinner: 1, gameLoser: 1 } }));
    expectInvalid(result);
    expect(result.message).toBe("Winner must win more sets than loser");
  });

  it("rejects set points that are all zero", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 0, gameLoser: 0 },
          { gameWinner: 0, gameLoser: 0 },
        ],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("If no points are recorded, the setPoints should not be included in the event data");
  });

  it("rejects a tied set", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 5 },
        ],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Points are invalid. No sets can be tied");
  });

  it("rejects set points where the loser wins as many sets as the winner", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 1, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 5, gameLoser: 11 },
        ],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Points are invalid. Winner must win more sets than loser");
  });

  it("rejects set points that do not match the winner's declared set count", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 3, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 11, gameLoser: 7 },
        ],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Points are invalid. Winner must win the correct amount of sets");
  });

  it("rejects set points that do not match the loser's declared set count", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 11, gameLoser: 5 },
          { gameWinner: 5, gameLoser: 11 },
          { gameWinner: 11, gameLoser: 5 },
        ],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Points are invalid. Loser must win the correct amount of sets");
  });

  it("accepts point sequences that match the set points", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 1 },
        setPoints: [
          { gameWinner: 3, gameLoser: 1 },
          { gameWinner: 1, gameLoser: 2 },
          { gameWinner: 2, gameLoser: 0 },
        ],
        pointSequences: ["WLWW", "LWL", "WW"],
      }),
    );
    expect(result).toEqual({ valid: true });
  });

  it("rejects point sequences without set points", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        pointSequences: ["WW", "WW"],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Point sequences require set points");
  });

  it("rejects point sequences when the number of sequences does not match the number of sets", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 2, gameLoser: 0 },
          { gameWinner: 2, gameLoser: 1 },
        ],
        pointSequences: ["WW"],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Point sequences are invalid. There must be one sequence per set");
  });

  it("rejects point sequences with characters other than W and L", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 1, gameLoser: 0 },
        setPoints: [{ gameWinner: 2, gameLoser: 0 }],
        pointSequences: ["W1"],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Point sequences are invalid. Only 'W' and 'L' points are allowed");
  });

  it("rejects a point sequence whose point counts do not match its set points", () => {
    const result = projector.validateScoreGame(
      scoreEvent("game-1", {
        setsWon: { gameWinner: 2, gameLoser: 0 },
        setPoints: [
          { gameWinner: 2, gameLoser: 0 },
          { gameWinner: 2, gameLoser: 1 },
        ],
        pointSequences: ["WW", "WLL"],
      }),
    );
    expectInvalid(result);
    expect(result.message).toBe("Point sequences are invalid. Sequence for set 2 does not match the set points");
  });

  it("currently accepts a score for a game that does not exist (documented gap)", () => {
    // validateScoreGame never checks the game stream, so a GAME_SCORE event
    // for an unknown game passes validation (the projection then no-ops).
    const emptyProjector = new GamesProjector();
    expect(
      emptyProjector.validateScoreGame(scoreEvent("no-such-game", { setsWon: { gameWinner: 2, gameLoser: 0 } })),
    ).toEqual({ valid: true });
  });
});
