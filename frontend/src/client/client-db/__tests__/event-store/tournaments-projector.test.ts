import { ValidatorResponse } from "../../event-store/projectors/validator-types";

// Narrows a validator result so the failure message can be read type-safely.
function expectInvalid(response: ValidatorResponse): asserts response is { valid: false; message: string } {
  expect(response.valid).toBe(false);
}

import { TournamentsProjector } from "../../event-store/projectors/tournaments-projector";
import {
  EventTypeEnum,
  TournamentCancelSignup,
  TournamentCreated,
  TournamentDeleted,
  TournamentSetPlayerOrder,
  TournamentSignup,
  TournamentSkipGame,
  TournamentUndoSkipGame,
  TournamentUpdated,
} from "../../event-store/event-types";

const ONE_DAY = 24 * 60 * 60 * 1000;
const FUTURE_START = Date.now() + 7 * ONE_DAY;
const PAST_START = Date.now() - 7 * ONE_DAY;

function createEvent(stream: string, data: Partial<TournamentCreated["data"]> = {}, time = 1000): TournamentCreated {
  return {
    time,
    stream,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: { name: "Spring Cup", startDate: FUTURE_START, groupPlay: false, ...data },
  };
}

function updateEvent(stream: string, data: TournamentUpdated["data"], time = 2000): TournamentUpdated {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_UPDATED, data };
}

function deleteEvent(stream: string, time = 3000): TournamentDeleted {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_DELETED, data: null };
}

function playerOrderEvent(stream: string, playerOrder: string[], time = 4000): TournamentSetPlayerOrder {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER, data: { playerOrder } };
}

function signupEvent(stream: string, player: string, time = 5000): TournamentSignup {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } };
}

function cancelSignupEvent(stream: string, player: string, time = 6000): TournamentCancelSignup {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP, data: { player } };
}

function skipEvent(stream: string, skipId: string, winner: string, loser: string, time = 7000): TournamentSkipGame {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_SKIP_GAME, data: { skipId, winner, loser } };
}

function undoSkipEvent(stream: string, skipId: string, time = 8000): TournamentUndoSkipGame {
  return { time, stream, type: EventTypeEnum.TOURNAMENT_UNDO_SKIP_GAME, data: { skipId } };
}

describe("TournamentsProjector projection", () => {
  it("creates a tournament with its full config", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(
      createEvent("t1", { name: "Spring Cup", description: "Yearly", groupPlay: true, doubleElimination: true }),
    );

    expect(projector.getTournamentConfig("t1")).toEqual({
      id: "t1",
      name: "Spring Cup",
      description: "Yearly",
      startDate: FUTURE_START,
      groupPlay: true,
      doubleElimination: true,
      overridePreferredGroupSize: undefined,
      deleted: false,
    });
  });

  it("applies partial updates without touching other fields", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.updateTournament(updateEvent("t1", { name: "Autumn Cup" }));

    const config = projector.getTournamentConfig("t1")!;
    expect(config.name).toBe("Autumn Cup");
    expect(config.startDate).toBe(FUTURE_START);
    expect(config.groupPlay).toBe(false);
  });

  it("hides deleted tournaments from the config getters", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.deleteTournament(deleteEvent("t1"));

    expect(projector.getTournamentConfig("t1")).toBeUndefined();
    expect(projector.getTournamentConfigs()).toEqual([]);
  });

  it("stores the player order", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.setPlayerOrder(playerOrderEvent("t1", ["p2", "p1"]));

    expect(projector.getTournamentConfig("t1")!.playerOrder).toEqual(["p2", "p1"]);
  });

  it("tracks signups and cancellations", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.signup(signupEvent("t1", "p1", 5000));
    projector.signup(signupEvent("t1", "p2", 5001));

    expect(projector.getTournamentSignups("t1")).toEqual([
      { player: "p1", time: 5000 },
      { player: "p2", time: 5001 },
    ]);

    projector.cancelSignup(cancelSignupEvent("t1", "p1"));
    expect(projector.getTournamentSignups("t1")).toEqual([{ player: "p2", time: 5001 }]);
  });

  it("tracks skipped games and undo of skips", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));
    projector.skipGame(skipEvent("t1", "skip-1", "p1", "p2", 7000));

    expect(projector.getTournamentSkippedGames("t1")).toEqual([
      { skipId: "skip-1", winner: "p1", loser: "p2", time: 7000 },
    ]);

    projector.undoSkipGame(undoSkipEvent("t1", "skip-1"));
    expect(projector.getTournamentSkippedGames("t1")).toEqual([]);
  });
});

describe("validateCreateTournament", () => {
  it("accepts a valid tournament", () => {
    const projector = new TournamentsProjector();
    expect(projector.validateCreateTournament(createEvent("t1"))).toEqual({ valid: true });
  });

  it("rejects a duplicate tournament id", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));

    const result = projector.validateCreateTournament(createEvent("t1"));
    expectInvalid(result);
    expect(result.message).toBe("Tournament with this ID already exists");
  });

  it("rejects an empty or whitespace-only name", () => {
    const projector = new TournamentsProjector();
    const result = projector.validateCreateTournament(createEvent("t1", { name: "   " }));
    expectInvalid(result);
    expect(result.message).toBe("Tournament name is required");
  });

  it("rejects a missing start date", () => {
    const projector = new TournamentsProjector();
    const result = projector.validateCreateTournament(createEvent("t1", { startDate: 0 }));
    expectInvalid(result);
    expect(result.message).toBe("Start date is required");
  });

  it("rejects a group size override below 2 and accepts 2", () => {
    const projector = new TournamentsProjector();
    const tooSmall = projector.validateCreateTournament(createEvent("t1", { overridePreferredGroupSize: 1 }));
    expectInvalid(tooSmall);
    expect(tooSmall.message).toBe("Group size must be 2 or higher");

    expect(projector.validateCreateTournament(createEvent("t1", { overridePreferredGroupSize: 2 }))).toEqual({
      valid: true,
    });
  });
});

describe("validateUpdateTournament", () => {
  it("rejects updating an unknown or deleted tournament", () => {
    const projector = new TournamentsProjector();
    expect(projector.validateUpdateTournament(updateEvent("nope", { name: "X" })).valid).toBe(false);

    projector.createTournament(createEvent("t1"));
    projector.deleteTournament(deleteEvent("t1"));
    const result = projector.validateUpdateTournament(updateEvent("t1", { name: "X" }));
    expectInvalid(result);
    expect(result.message).toBe("Tournament does not exist");
  });

  it("accepts changing the start date before the tournament starts", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    expect(projector.validateUpdateTournament(updateEvent("t1", { startDate: FUTURE_START + ONE_DAY }))).toEqual({
      valid: true,
    });
  });

  it("rejects changing the start date, group play or double elimination after start", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));

    const startDate = projector.validateUpdateTournament(updateEvent("t1", { startDate: FUTURE_START }));
    expectInvalid(startDate);
    expect(startDate.message).toBe("Cannot change start date after tournament has started");

    const groupPlay = projector.validateUpdateTournament(updateEvent("t1", { groupPlay: true }));
    expectInvalid(groupPlay);
    expect(groupPlay.message).toBe("Cannot change group play setting after tournament has started");

    const doubleElim = projector.validateUpdateTournament(updateEvent("t1", { doubleElimination: true }));
    expectInvalid(doubleElim);
    expect(doubleElim.message).toBe("Cannot change double elimination setting after tournament has started");
  });

  it("still allows renaming a started tournament", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));
    expect(projector.validateUpdateTournament(updateEvent("t1", { name: "New name" }))).toEqual({ valid: true });
  });

  it("rejects an empty name update", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));

    const result = projector.validateUpdateTournament(updateEvent("t1", { name: " " }));
    expectInvalid(result);
    expect(result.message).toBe("Tournament name cannot be empty");
  });
});

describe("validateDeleteTournament", () => {
  it("accepts deleting an existing tournament and rejects a second delete", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    expect(projector.validateDeleteTournament(deleteEvent("t1"))).toEqual({ valid: true });

    projector.deleteTournament(deleteEvent("t1"));
    const result = projector.validateDeleteTournament(deleteEvent("t1", 3100));
    expectInvalid(result);
    expect(result.message).toBe("Tournament does not exist");
  });

  it("rejects deleting an unknown tournament", () => {
    const projector = new TournamentsProjector();
    expect(projector.validateDeleteTournament(deleteEvent("nope")).valid).toBe(false);
  });
});

describe("validateSetPlayerOrder", () => {
  it("accepts a non-empty player order for an existing tournament", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    expect(projector.validateSetPlayerOrder(playerOrderEvent("t1", ["p1"]))).toEqual({ valid: true });
  });

  it("rejects an unknown tournament", () => {
    const projector = new TournamentsProjector();
    const result = projector.validateSetPlayerOrder(playerOrderEvent("nope", ["p1"]));
    expectInvalid(result);
    expect(result.message).toBe("Tournament does not exist");
  });

  it("rejects an empty player order", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));

    const result = projector.validateSetPlayerOrder(playerOrderEvent("t1", []));
    expectInvalid(result);
    expect(result.message).toBe("Player order cannot be empty");
  });
});

describe("validateSignup / validateCancelSignup", () => {
  it("accepts a signup before the tournament starts", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    expect(projector.validateSignup(signupEvent("t1", "p1"))).toEqual({ valid: true });
  });

  it("rejects a duplicate signup", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.signup(signupEvent("t1", "p1"));

    const result = projector.validateSignup(signupEvent("t1", "p1", 5100));
    expectInvalid(result);
    expect(result.message).toBe("Player already signed up");
  });

  it("rejects a signup after the tournament has started", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));

    const result = projector.validateSignup(signupEvent("t1", "p1"));
    expectInvalid(result);
    expect(result.message).toBe("Cannot sign up after tournament has started");
  });

  it("rejects a signup for an unknown tournament (with a misleading message)", () => {
    // The missing tournament falls back to startDate 0, so the rejection
    // message claims the tournament has started. Documenting current behavior.
    const projector = new TournamentsProjector();
    const result = projector.validateSignup(signupEvent("nope", "p1"));
    expectInvalid(result);
    expect(result.message).toBe("Cannot sign up after tournament has started");
  });

  it("accepts cancelling an existing signup and rejects cancelling a missing one", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));
    projector.signup(signupEvent("t1", "p1"));

    expect(projector.validateCancelSignup(cancelSignupEvent("t1", "p1"))).toEqual({ valid: true });

    const result = projector.validateCancelSignup(cancelSignupEvent("t1", "p2"));
    expectInvalid(result);
    expect(result.message).toBe("Player not signed up");
  });
});

describe("validateSkipGame / validateUndoSkipGame", () => {
  it("accepts a skip after the tournament has started", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));
    expect(projector.validateSkipGame(skipEvent("t1", "skip-1", "p1", "p2"))).toEqual({ valid: true });
  });

  it("rejects a duplicate skip id", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));
    projector.skipGame(skipEvent("t1", "skip-1", "p1", "p2"));

    const result = projector.validateSkipGame(skipEvent("t1", "skip-1", "p1", "p2", 7100));
    expectInvalid(result);
    expect(result.message).toBe("Game already skipped");
  });

  it("rejects skipping before the tournament has started", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1"));

    const result = projector.validateSkipGame(skipEvent("t1", "skip-1", "p1", "p2"));
    expectInvalid(result);
    expect(result.message).toBe("Cannot skip games before tournament has started");
  });

  it("rejects skipping in an unknown tournament", () => {
    const projector = new TournamentsProjector();
    const result = projector.validateSkipGame(skipEvent("nope", "skip-1", "p1", "p2"));
    expectInvalid(result);
    expect(result.message).toBe("Cannot skip games before tournament has started");
  });

  it("accepts undoing an existing skip and rejects undoing a missing one", () => {
    const projector = new TournamentsProjector();
    projector.createTournament(createEvent("t1", { startDate: PAST_START }));
    projector.skipGame(skipEvent("t1", "skip-1", "p1", "p2"));

    expect(projector.validateUndoSkipGame(undoSkipEvent("t1", "skip-1"))).toEqual({ valid: true });

    const result = projector.validateUndoSkipGame(undoSkipEvent("t1", "skip-2"));
    expectInvalid(result);
    expect(result.message).toBe("Game skip does not exist");
  });
});
