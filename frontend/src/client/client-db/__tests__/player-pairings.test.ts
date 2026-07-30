import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { PlayerPairingsOptions } from "../player-pairings";

let time = 0;
const nextTime = () => ++time;

function player(id: string): EventType {
  return { time: nextTime(), stream: id, type: EventTypeEnum.PLAYER_CREATED, data: { name: id } };
}

function deactivate(id: string): EventType {
  return { time: nextTime(), stream: id, type: EventTypeEnum.PLAYER_DEACTIVATED, data: null };
}

function games(winner: string, loser: string, count = 1): EventType[] {
  return Array.from({ length: count }, (_, index) => {
    const playedAt = nextTime();
    return {
      time: playedAt,
      stream: `game-${winner}-${loser}-${index}-${playedAt}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    };
  });
}

function pairings(events: EventType[], playerId: string, options?: PlayerPairingsOptions) {
  const result = new TennisTable({ events }).playerPairings.get(playerId, options);
  return {
    columns: result.columns.map((column) => ({
      degree: column.degree,
      players: column.players.map((p) => p.playerId),
    })),
    unreachable: result.unreachable,
  };
}

describe("PlayerPairings", () => {
  beforeEach(() => {
    time = 0;
  });

  it("sorts played opponents by games played, most first", () => {
    const events = [
      player("me"),
      player("a"),
      player("b"),
      player("c"),
      ...games("me", "a", 1),
      ...games("me", "b", 3),
      ...games("c", "me", 2),
    ];

    expect(pairings(events, "me")).toEqual({
      columns: [{ degree: 1, players: ["b", "c", "a"] }],
      unreachable: [],
    });
  });

  it("groups players by the number of intermediaries between them", () => {
    const events = [
      player("me"),
      player("a"),
      player("b"),
      player("c"),
      ...games("me", "a"),
      ...games("a", "b"),
      ...games("b", "c"),
    ];

    expect(pairings(events, "me")).toEqual({
      columns: [
        { degree: 1, players: ["a"] },
        { degree: 2, players: ["b"] },
        { degree: 3, players: ["c"] },
      ],
      unreachable: [],
    });
  });

  it("sorts indirect players by the games on the last hop", () => {
    const events = [
      player("me"),
      player("hub"),
      player("few"),
      player("many"),
      ...games("me", "hub"),
      ...games("hub", "few", 1),
      ...games("hub", "many", 5),
    ];

    expect(pairings(events, "me").columns[1]).toEqual({ degree: 2, players: ["many", "few"] });
  });

  it("picks the path with the most games on the last hop when several are equally long", () => {
    const events = [
      player("me"),
      player("weak-hub"),
      player("strong-hub"),
      player("target"),
      ...games("me", "weak-hub", 10),
      ...games("me", "strong-hub", 1),
      ...games("weak-hub", "target", 2),
      ...games("strong-hub", "target", 7),
    ];

    const result = new TennisTable({ events }).playerPairings.get("me");
    const target = result.columns[1].players[0];

    expect(target.playerId).toBe("target");
    expect(target.games).toBe(7);
    expect(target.path).toEqual(["strong-hub", "target"]);
  });

  it("lists players with no connecting games as unreachable", () => {
    const events = [
      player("me"),
      player("a"),
      player("lonely"),
      player("island-1"),
      player("island-2"),
      ...games("me", "a"),
      ...games("island-1", "island-2"),
    ];

    expect(pairings(events, "me")).toEqual({
      columns: [{ degree: 1, players: ["a"] }],
      unreachable: ["island-1", "island-2", "lonely"],
    });
  });

  it("excludes retired players and does not route paths through them", () => {
    const events = [
      player("me"),
      player("retired"),
      player("behind-retired"),
      ...games("me", "retired"),
      ...games("retired", "behind-retired"),
      deactivate("retired"),
    ];

    expect(pairings(events, "me")).toEqual({
      columns: [],
      unreachable: ["behind-retired"],
    });
  });

  it("still connects a retired player through their own games", () => {
    const events = [
      player("me"),
      player("a"),
      player("b"),
      ...games("me", "a"),
      ...games("a", "b"),
      deactivate("me"),
    ];

    expect(pairings(events, "me")).toEqual({
      columns: [
        { degree: 1, players: ["a"] },
        { degree: 2, players: ["b"] },
      ],
      unreachable: [],
    });
  });

  it("includes retired players and routes paths through them when asked to", () => {
    const events = [
      player("me"),
      player("retired"),
      player("behind-retired"),
      ...games("me", "retired"),
      ...games("retired", "behind-retired"),
      deactivate("retired"),
    ];

    expect(pairings(events, "me", { includeRetired: true })).toEqual({
      columns: [
        { degree: 1, players: ["retired"] },
        { degree: 2, players: ["behind-retired"] },
      ],
      unreachable: [],
    });
  });

  it("lists a retired player with no connecting games as unreachable when included", () => {
    const events = [player("me"), player("a"), player("gone"), ...games("me", "a"), deactivate("gone")];

    expect(pairings(events, "me", { includeRetired: true })).toEqual({
      columns: [{ degree: 1, players: ["a"] }],
      unreachable: ["gone"],
    });
  });

  it("only links players who have played each other the required number of times", () => {
    const events = [
      player("me"),
      player("often"),
      player("once"),
      player("behind-once"),
      ...games("me", "often", 3),
      ...games("me", "once", 1),
      ...games("once", "behind-once", 4),
    ];

    expect(pairings(events, "me", { minGamesPerLink: 3 })).toEqual({
      columns: [{ degree: 1, players: ["often"] }],
      unreachable: ["behind-once", "once"],
    });
  });

  it("reaches players through a longer route when the short one is below the threshold", () => {
    const events = [
      player("me"),
      player("hub"),
      player("target"),
      ...games("me", "hub", 5),
      ...games("hub", "target", 5),
      ...games("me", "target", 1),
    ];

    expect(pairings(events, "me", { minGamesPerLink: 2 })).toEqual({
      columns: [
        { degree: 1, players: ["hub"] },
        { degree: 2, players: ["target"] },
      ],
      unreachable: [],
    });
  });

  it("never includes the player themselves", () => {
    const events = [player("me"), player("a"), ...games("me", "a")];
    const result = pairings(events, "me");

    expect(result.columns.flatMap((c) => c.players)).not.toContain("me");
    expect(result.unreachable).not.toContain("me");
  });
});
