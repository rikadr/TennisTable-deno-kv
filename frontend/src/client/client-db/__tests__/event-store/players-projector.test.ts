import { expectInvalid } from "../../event-store/projectors/validator-test-utils";
import { PlyersProjector } from "../../event-store/projectors/players-projector";
import {
  EventTypeEnum,
  PlayerCreated,
  PlayerDeactivated,
  PlayerNameUpdated,
  PlayerReactivated,
} from "../../event-store/event-types";

function createEvent(stream: string, name: string, time = 1000): PlayerCreated {
  return { time, stream, type: EventTypeEnum.PLAYER_CREATED, data: { name } };
}

function deactivateEvent(stream: string, time = 2000): PlayerDeactivated {
  return { time, stream, type: EventTypeEnum.PLAYER_DEACTIVATED, data: null };
}

function reactivateEvent(stream: string, time = 3000): PlayerReactivated {
  return { time, stream, type: EventTypeEnum.PLAYER_REACTIVATED, data: null };
}

function updateNameEvent(stream: string, updatedName: string, time = 4000): PlayerNameUpdated {
  return { time, stream, type: EventTypeEnum.PLAYER_NAME_UPDATED, data: { updatedName } };
}

describe("PlayersProjector projection", () => {
  it("creates an active player from a PLAYER_CREATED event", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice", 1234));

    expect(projector.getPlayer("player-1")).toEqual({
      id: "player-1",
      name: "Alice",
      active: true,
      createdAt: 1234,
      updatedAt: 1234,
    });
    expect(projector.activePlayers).toHaveLength(1);
    expect(projector.inactivePlayers).toHaveLength(0);
  });

  it("moves a player between active and inactive on deactivate/reactivate", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    projector.deactivatePlayer(deactivateEvent("player-1", 2000));
    expect(projector.getPlayer("player-1")!.active).toBe(false);
    expect(projector.getPlayer("player-1")!.updatedAt).toBe(2000);
    expect(projector.getPlayer("player-1")!.updateAction).toBe("Deactivated");
    expect(projector.activePlayers).toHaveLength(0);
    expect(projector.inactivePlayers).toHaveLength(1);

    projector.reactivatePlayer(reactivateEvent("player-1", 3000));
    expect(projector.getPlayer("player-1")!.active).toBe(true);
    expect(projector.getPlayer("player-1")!.updatedAt).toBe(3000);
    expect(projector.getPlayer("player-1")!.updateAction).toBe("Re-activated");
    expect(projector.activePlayers).toHaveLength(1);
  });

  it("updates the player name and records the previous name", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    projector.updateName(updateNameEvent("player-1", "Alicia", 4000));

    const player = projector.getPlayer("player-1")!;
    expect(player.name).toBe("Alicia");
    expect(player.updatedAt).toBe(4000);
    expect(player.updateAction).toBe("Name updated from Alice");
  });

  it("returns undefined for an unknown player", () => {
    const projector = new PlyersProjector();
    expect(projector.getPlayer("nope")).toBeUndefined();
  });
});

describe("validateCreatePlayer", () => {
  it("accepts a new player with a valid name", () => {
    const projector = new PlyersProjector();
    expect(projector.validateCreatePlayer(createEvent("player-1", "Alice"))).toEqual({ valid: true });
  });

  it("rejects a duplicate stream", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateCreatePlayer(createEvent("player-1", "Bob"));
    expectInvalid(result);
    expect(result.message).toBe("Player stream already exists");
  });

  it("rejects a duplicate name", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateCreatePlayer(createEvent("player-2", "Alice"));
    expectInvalid(result);
    expect(result.message).toBe("Player name already exists");
  });

  it("rejects a duplicate name in a different case", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateCreatePlayer(createEvent("player-2", "ALICE"));
    expectInvalid(result);
    expect(result.message).toBe("Player name already exists");
  });

  it("rejects a name that does not start with an uppercase letter", () => {
    const projector = new PlyersProjector();
    const result = projector.validateCreatePlayer(createEvent("player-1", "alice"));
    expectInvalid(result);
    expect(result.message).toBe("First letter must be uppercase");
  });

  it("rejects a name with special characters", () => {
    const projector = new PlyersProjector();
    const result = projector.validateCreatePlayer(createEvent("player-1", "Alice!"));
    expectInvalid(result);
    expect(result.message).toBe("Name can not contain special or invalid characters.");
  });

  it("rejects a name with leading or trailing whitespace", () => {
    const projector = new PlyersProjector();
    const result = projector.validateCreatePlayer(createEvent("player-1", "Alice "));
    expectInvalid(result);
    expect(result.message).toBe("Name can not start or end with whitespaces");
  });

  it("currently accepts an empty name (suspected bug: no minimum length check)", () => {
    // The first-letter check compares undefined === undefined for an empty
    // string, so "" slips through every rule. Documenting current behavior.
    const projector = new PlyersProjector();
    expect(projector.validateCreatePlayer(createEvent("player-1", ""))).toEqual({ valid: true });
  });
});

describe("validateDeactivatePlayer / validateReactivatePlayer", () => {
  it("accepts deactivating an active player", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    expect(projector.validateDeactivatePlayer(deactivateEvent("player-1"))).toEqual({ valid: true });
  });

  it("rejects deactivating an unknown player", () => {
    const projector = new PlyersProjector();
    const result = projector.validateDeactivatePlayer(deactivateEvent("nope"));
    expectInvalid(result);
    expect(result.message).toBe("Player does not exist");
  });

  it("rejects deactivating an already inactive player", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    projector.deactivatePlayer(deactivateEvent("player-1"));

    const result = projector.validateDeactivatePlayer(deactivateEvent("player-1", 5000));
    expectInvalid(result);
    expect(result.message).toBe("Player is already inactive");
  });

  it("accepts reactivating an inactive player", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    projector.deactivatePlayer(deactivateEvent("player-1"));
    expect(projector.validateReactivatePlayer(reactivateEvent("player-1"))).toEqual({ valid: true });
  });

  it("rejects reactivating an unknown player", () => {
    const projector = new PlyersProjector();
    const result = projector.validateReactivatePlayer(reactivateEvent("nope"));
    expectInvalid(result);
    expect(result.message).toBe("Player does not exist");
  });

  it("rejects reactivating an already active player", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateReactivatePlayer(reactivateEvent("player-1"));
    expectInvalid(result);
    expect(result.message).toBe("Player is already active");
  });
});

describe("validateUpdateName", () => {
  it("accepts a new valid name", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    expect(projector.validateUpdateName(updateNameEvent("player-1", "Alicia"))).toEqual({ valid: true });
  });

  it("rejects updating an unknown player", () => {
    const projector = new PlyersProjector();
    const result = projector.validateUpdateName(updateNameEvent("nope", "Alicia"));
    expectInvalid(result);
    expect(result.message).toBe("Player does not exist");
  });

  it("rejects the unchanged name", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateUpdateName(updateNameEvent("player-1", "Alice"));
    expectInvalid(result);
    expect(result.message).toBe("Player name is already the same");
  });

  it("rejects taking another player's name, case-insensitively", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    projector.createPlayer(createEvent("player-2", "Bob", 1100));

    const result = projector.validateUpdateName(updateNameEvent("player-2", "ALICE"));
    expectInvalid(result);
    expect(result.message).toBe("Player name already exists");
  });

  it("allows a case-only change of the player's own name", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));
    expect(projector.validateUpdateName(updateNameEvent("player-1", "ALICE"))).toEqual({ valid: true });
  });

  it("still applies the name format rules", () => {
    const projector = new PlyersProjector();
    projector.createPlayer(createEvent("player-1", "Alice"));

    const result = projector.validateUpdateName(updateNameEvent("player-1", "alicia"));
    expectInvalid(result);
    expect(result.message).toBe("First letter must be uppercase");
  });
});
