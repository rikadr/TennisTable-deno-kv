import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TournamentBracket } from "../../tournaments/bracket";
import { Tournament } from "../../tournaments/tournament";

const TOURNAMENT_ID = "tournament-1";
const START_DATE = 100_000; // Far in the past so the tournament has started

function baseEvents(players: string[], options?: { doubleElimination?: boolean }): EventType[] {
  const events: EventType[] = [];
  let time = 1_000;
  for (const player of players) {
    events.push({ time: time++, stream: player, type: EventTypeEnum.PLAYER_CREATED, data: { name: player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: {
      name: "Double elimination test",
      startDate: START_DATE,
      groupPlay: false,
      doubleElimination: options?.doubleElimination ?? true,
    },
  });
  for (const player of players) {
    events.push({
      time: time++,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SIGNUP,
      data: { player },
    });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
    data: { playerOrder: players },
  });
  return events;
}

let gameTime = 200_000;
function gameEvent(winner: string, loser: string): EventType {
  gameTime += 1;
  return {
    time: gameTime,
    stream: `game-${gameTime}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: gameTime, winner, loser },
  };
}

function skipEvent(winner: string, loser: string): EventType {
  gameTime += 1;
  return {
    time: gameTime,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
    data: { skipId: `skip-${gameTime}`, winner, loser },
  };
}

function getTournament(events: EventType[]): Tournament {
  const tennisTable = new TennisTable({ events });
  const tournament = tennisTable.tournaments.getTournament(TOURNAMENT_ID);
  expect(tournament).toBeDefined();
  return tournament!;
}

function pendingPairs(tournament: Tournament): string[] {
  return tournament
    .findAllPendingGames()
    .map((game) => `${game.player1} vs ${game.player2}`)
    .sort();
}

beforeEach(() => {
  gameTime = 200_000;
});

describe("Double elimination bracket structure", () => {
  it("builds losers bracket, grand final and bracket reset for 4 players", () => {
    const tournament = getTournament(baseEvents(["P1", "P2", "P3", "P4"]));
    const bracket = tournament.bracket!;

    expect(bracket.doubleElimination).toBe(true);
    // Winners bracket: 2 layers (final + semis)
    expect(bracket.bracket).toHaveLength(2);
    // Losers bracket: 2 rounds
    expect(bracket.losersBracket).toHaveLength(2);
    expect(bracket.losersBracket![0]).toHaveLength(1);
    expect(bracket.losersBracket![1]).toHaveLength(1);
    expect(bracket.grandFinal).toBeDefined();
    expect(bracket.bracketReset).toBeDefined();

    // Semifinal losers drop into losers round 1
    expect(bracket.bracket[1][0].loserAdvanceTo).toEqual({
      section: "losers",
      layerIndex: 1,
      gameIndex: 0,
      role: "player1",
    });
    expect(bracket.bracket[1][1].loserAdvanceTo).toEqual({
      section: "losers",
      layerIndex: 1,
      gameIndex: 0,
      role: "player2",
    });
    // The winners final loser drops into the losers final, and its winner goes to the grand final
    expect(bracket.bracket[0][0].loserAdvanceTo).toEqual({
      section: "losers",
      layerIndex: 0,
      gameIndex: 0,
      role: "player2",
    });
    expect(bracket.bracket[0][0].advanceTo).toEqual({
      section: "grandFinal",
      layerIndex: 0,
      gameIndex: 0,
      role: "player1",
    });
    expect(bracket.losersBracket![0][0].advanceTo).toEqual({
      section: "grandFinal",
      layerIndex: 0,
      gameIndex: 0,
      role: "player2",
    });
  });

  it("does not build double elimination structures when the option is off", () => {
    const tournament = getTournament(baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: false }));
    const bracket = tournament.bracket!;
    expect(bracket.doubleElimination).toBe(false);
    expect(bracket.losersBracket).toBeUndefined();
    expect(bracket.grandFinal).toBeUndefined();
    expect(bracket.bracketReset).toBeUndefined();
    expect(bracket.bracket[0][0].loserAdvanceTo).toBeUndefined();
  });
});

describe("Double elimination with 4 players", () => {
  const players = ["P1", "P2", "P3", "P4"];
  // Seeding: semifinals are P1 vs P4 and P2 vs P3

  it("routes losers into the losers bracket and champions into the grand final", () => {
    const events = [...baseEvents(players), gameEvent("P1", "P4"), gameEvent("P2", "P3")];
    let tournament = getTournament(events);
    // Winners final P1 vs P2 + losers round 1 P4 vs P3
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2", "P4 vs P3"]);

    events.push(gameEvent("P4", "P3"), gameEvent("P1", "P2"));
    tournament = getTournament(events);
    // Losers final: P4 (losers survivor) vs P2 (winners final loser)
    expect(pendingPairs(tournament)).toEqual(["P4 vs P2"]);

    events.push(gameEvent("P2", "P4"));
    tournament = getTournament(events);
    // Grand final: P1 (winners champion) vs P2 (losers champion) — a rematch of the winners final
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2"]);
    expect(tournament.bracket!.grandFinal!.player1).toBe("P1");
    expect(tournament.bracket!.grandFinal!.player2).toBe("P2");
    expect(tournament.winner).toBeUndefined();
    expect(tournament.endDate).toBeUndefined();
  });

  it("crowns the winners bracket champion when they win the grand final (no bracket reset)", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"),
      gameEvent("P1", "P2"), // Winners final
      gameEvent("P2", "P4"), // Losers final
      gameEvent("P1", "P2"), // Grand final — rematch fills the grand final, not the winners final again
    ];
    const tournament = getTournament(events);
    expect(tournament.winner).toBe("P1");
    expect(tournament.endDate).toBe(tournament.bracket!.grandFinal!.completedAt);
    expect(tournament.hasPendingGames).toBe(false);
    // The bracket reset was never activated
    expect(tournament.bracket!.bracketReset!.player1).toBeUndefined();
  });

  it("activates the bracket reset when the losers bracket champion wins the grand final", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"),
      gameEvent("P1", "P2"), // Winners final
      gameEvent("P2", "P4"), // Losers final
      gameEvent("P2", "P1"), // Grand final: losers champion wins
    ];
    let tournament = getTournament(events);
    // No champion yet: the bracket reset match must be played
    expect(tournament.winner).toBeUndefined();
    expect(tournament.endDate).toBeUndefined();
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2"]);
    expect(tournament.bracket!.bracketReset!.player1).toBe("P1");
    expect(tournament.bracket!.bracketReset!.player2).toBe("P2");

    events.push(gameEvent("P2", "P1")); // Bracket reset
    tournament = getTournament(events);
    expect(tournament.winner).toBe("P2");
    expect(tournament.endDate).toBe(tournament.bracket!.bracketReset!.completedAt);
    expect(tournament.hasPendingGames).toBe(false);
  });

  it("supports skipped games in the losers bracket", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      skipEvent("P4", "P3"), // Losers round 1 walkover
    ];
    const tournament = getTournament(events);
    const losersRound1 = tournament.bracket!.losersBracket![1][0];
    expect(losersRound1.winner).toBe("P4");
    expect(losersRound1.skipped).toBeDefined();
    // P4 advanced to the losers final and awaits the winners final loser
    expect(tournament.bracket!.losersBracket![0][0].player1).toBe("P4");
  });
});

describe("Double elimination with byes (3 players)", () => {
  const players = ["P1", "P2", "P3"];
  // P1 has a bye to the winners final; P2 vs P3 is the only first round game

  it("collapses bye games and passes players through", () => {
    const tournament = getTournament(baseEvents(players));
    const bracket = tournament.bracket!;
    // Losers round 1 can never be played: only one winners first-round game produces a loser
    expect(bracket.losersBracket![1][0].isBye).toBe(true);
    expect(pendingPairs(tournament)).toEqual(["P2 vs P3"]);
  });

  it("plays a full double elimination with a bye", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P2", "P3"), // Winners round 1: P3 passes through the losers bye into the losers final
      gameEvent("P1", "P2"), // Winners final: P2 drops into the losers final
    ];
    let tournament = getTournament(events);
    expect(pendingPairs(tournament)).toEqual(["P3 vs P2"]);

    events.push(gameEvent("P3", "P2")); // Losers final
    events.push(gameEvent("P1", "P3")); // Grand final
    tournament = getTournament(events);
    expect(tournament.winner).toBe("P1");
    expect(tournament.hasPendingGames).toBe(false);
  });
});

describe("Double elimination with 2 players", () => {
  const players = ["P1", "P2"];

  it("gives the final loser a second chance directly in the grand final", () => {
    const events = [...baseEvents(players), gameEvent("P1", "P2")];
    let tournament = getTournament(events);
    expect(tournament.bracket!.losersBracket).toHaveLength(0);
    expect(tournament.winner).toBeUndefined();
    // Grand final rematch
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2"]);

    events.push(gameEvent("P2", "P1")); // Losers champion (P2) wins the grand final
    tournament = getTournament(events);
    expect(tournament.winner).toBeUndefined();
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2"]); // Bracket reset

    events.push(gameEvent("P1", "P2"));
    tournament = getTournament(events);
    expect(tournament.winner).toBe("P1");
  });
});

describe("Double elimination with 5 players (uneven bracket)", () => {
  const players = ["P1", "P2", "P3", "P4", "P5"];
  // Winners bracket: P4 vs P5 qualifier; semis P1 vs (P4/P5 winner) and P2 vs P3

  it("plays through with byes collapsing in the losers bracket", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P4", "P5"), // Qualifier: P5 passes through losers round 1
      gameEvent("P1", "P4"), // Semi 1: P4 drops (cross-seeded past P5's game)
      gameEvent("P2", "P3"), // Semi 2: P3 drops and meets P5
    ];
    let tournament = getTournament(events);
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2", "P5 vs P3"]);

    events.push(gameEvent("P5", "P3"));
    tournament = getTournament(events);
    // Losers: P5 now meets P4 (semi 1 loser); winners final still pending
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2", "P5 vs P4"]);

    events.push(gameEvent("P1", "P2")); // Winners final: P2 drops into the losers final
    events.push(gameEvent("P5", "P4")); // P5 advances to the losers final
    tournament = getTournament(events);
    expect(pendingPairs(tournament)).toEqual(["P5 vs P2"]);

    events.push(gameEvent("P2", "P5")); // Losers final
    events.push(gameEvent("P1", "P2")); // Grand final
    tournament = getTournament(events);
    expect(tournament.winner).toBe("P1");
    expect(tournament.hasPendingGames).toBe(false);
    // Everyone except the champion was eliminated with exactly two losses or fewer: 2n - 2 games
    expect(tournament.bracket!.getCompletedGames()).toHaveLength(8);
  });
});

describe("Double elimination simulation", () => {
  const player1AlwaysWins = (player1: string, player2: string) => ({
    winner: player1,
    loser: player2,
    confidence: 1,
  });
  const player2AlwaysWins = (player1: string, player2: string) => ({
    winner: player2,
    loser: player1,
    confidence: 1,
  });

  it("simulates a full double elimination bracket without a reset", () => {
    const result = TournamentBracket.simulateWinnerFromStatic(player1AlwaysWins, 500_000, ["P1", "P2", "P3", "P4"], true);
    // P1 wins everything from the player1 slot; 3 winners games + 2 losers games + grand final
    expect(result.winner).toBe("P1");
    expect(result.gamesSimulatedCount).toBe(6);
  });

  it("simulates the bracket reset when the losers champion wins the grand final", () => {
    const result = TournamentBracket.simulateWinnerFromStatic(player2AlwaysWins, 500_000, ["P1", "P2", "P3", "P4"], true);
    // player2 always wins, so the losers bracket champion wins the grand final and the reset is played
    expect(result.gamesSimulatedCount).toBe(7);
    expect(result.winner).toBeDefined();
  });

  it("simulates the remainder of a partially played tournament", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"]),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"),
    ];
    const tournament = getTournament(events);
    const result = tournament.bracket!.simulateWinnerFromExisting(player1AlwaysWins, 500_000);
    // Remaining: winners final, losers final, grand final
    expect(result.gamesSimulatedCount).toBe(3);
    expect(result.winner).toBe("P1");
  });

  it("still simulates single elimination brackets", () => {
    const result = TournamentBracket.simulateWinnerFromStatic(player1AlwaysWins, 500_000, ["P1", "P2", "P3", "P4"]);
    expect(result.winner).toBe("P1");
    expect(result.gamesSimulatedCount).toBe(3);
  });
});

describe("findGameByPlayers (used for tab selection after registering a game)", () => {
  it("locates a just-completed losers bracket game in the losers section", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"]),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"), // Losers round 1, just registered
    ];
    const bracket = getTournament(events).bracket!;
    expect(bracket.findGameByPlayers("P4", "P3")?.section).toBe("losers");
    // The winners semifinal is found in the winners section
    expect(bracket.findGameByPlayers("P1", "P4")?.section).toBe("winners");
  });

  it("prefers the pending rematch over the completed earlier meeting", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"]),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"),
      gameEvent("P1", "P2"), // Winners final
      gameEvent("P2", "P4"), // Losers final -> grand final is P1 vs P2 again
    ];
    const bracket = getTournament(events).bracket!;
    expect(bracket.findGameByPlayers("P1", "P2")?.section).toBe("grandFinal");
  });

  it("returns the latest completed meeting when nothing is pending", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"]),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P4", "P3"),
      gameEvent("P1", "P2"), // Winners final
      gameEvent("P2", "P4"), // Losers final
      gameEvent("P1", "P2"), // Grand final, just registered — tournament over
    ];
    const bracket = getTournament(events).bracket!;
    expect(bracket.findGameByPlayers("P1", "P2")?.section).toBe("grandFinal");
  });
});

describe("Single elimination regression", () => {
  it("works exactly as before when double elimination is off", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: false }),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
    ];
    let tournament = getTournament(events);
    expect(pendingPairs(tournament)).toEqual(["P1 vs P2"]);

    events.push(gameEvent("P1", "P2"));
    tournament = getTournament(events);
    expect(tournament.winner).toBe("P1");
    expect(tournament.endDate).toBeDefined();
    expect(tournament.hasPendingGames).toBe(false);
  });
});
