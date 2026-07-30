import { ONE_DAY, ONE_YEAR } from "../../../../common/time-in-ms";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import {
  buildTournamentConnections,
  PairMeeting,
  PlayerArrival,
  TournamentConnections,
} from "../../tournaments/tournament-connections";

const TOURNAMENT_ID = "tournament-1";
const EARLIER_TOURNAMENT_ID = "tournament-0";
/** Far enough into the past to leave room for years of club history before the tournament */
const START = 3 * ONE_YEAR;

/** Timestamps are expressed as whole days from the tournament start, which keeps them readable */
const day = (days: number) => START + days * ONE_DAY;
const before = (days: number) => START - days * ONE_DAY;

type Options = { doubleElimination?: boolean };

/**
 * The tournament under test, plus any players who only exist in the club history so that a
 * tournament player can be given a past without pairing them up with another participant
 */
function baseEvents(players: string[], options?: Options, historyOnlyPlayers: string[] = []): EventType[] {
  const events: EventType[] = [];
  let time = 1_000;
  for (const player of [...players, ...historyOnlyPlayers]) {
    events.push({ time: time++, stream: player, type: EventTypeEnum.PLAYER_CREATED, data: { name: player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: {
      name: "Connections test",
      startDate: START,
      groupPlay: false,
      doubleElimination: options?.doubleElimination ?? false,
    },
  });
  for (const player of players) {
    events.push({ time: time++, stream: TOURNAMENT_ID, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
    data: { playerOrder: players },
  });
  return events;
}

/** A complete 4 player tournament held before the one under test */
function earlierTournament(players: [string, string, string, string], startDate: number): EventType[] {
  let time = 500;
  const events: EventType[] = [
    {
      time: time++,
      stream: EARLIER_TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_CREATED,
      data: { name: "Last year", startDate, groupPlay: false, doubleElimination: false },
    },
  ];
  for (const player of players) {
    events.push({
      time: time++,
      stream: EARLIER_TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SIGNUP,
      data: { player },
    });
  }
  events.push({
    time: time++,
    stream: EARLIER_TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
    data: { playerOrder: players },
  });
  const [p1, p2, p3, p4] = players;
  // Seeded 1v4 and 2v3, then the final. Played out in full so no later game can fill it
  events.push(gameEvent(p1, p4, startDate + ONE_DAY));
  events.push(gameEvent(p2, p3, startDate + 2 * ONE_DAY));
  events.push(gameEvent(p1, p2, startDate + 3 * ONE_DAY));
  return events;
}

function gameEvent(winner: string, loser: string, playedAt: number): EventType {
  return {
    time: playedAt,
    stream: `game-${winner}-${loser}-${playedAt}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  };
}

function skipEvent(winner: string, loser: string, time: number): EventType {
  return {
    time,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
    data: { skipId: `skip-${time}`, winner, loser },
  };
}

function connections(events: EventType[]): TournamentConnections | undefined {
  const context = new TennisTable({ events });
  const tournament = context.tournaments.getTournament(TOURNAMENT_ID);
  expect(tournament).toBeDefined();
  return buildTournamentConnections(tournament!, context);
}

function pair(result: TournamentConnections, player1: string, player2: string): PairMeeting {
  const key = [player1, player2].sort().join("|");
  const found = result.pairs.find((candidate) => candidate.key === key);
  expect(found).toBeDefined();
  return found!;
}

function arrival(result: TournamentConnections, playerId: string): PlayerArrival {
  const found = result.arrivals.find((candidate) => candidate.playerId === playerId);
  expect(found).toBeDefined();
  return found!;
}

/** The semifinals of a 4 player bracket seeded P1, P2, P3, P4 are P1 vs P4 and P2 vs P3 */
const bracketGames = [gameEvent("P1", "P4", day(1)), gameEvent("P2", "P3", day(2)), gameEvent("P1", "P2", day(3))];

/** Recent games against a player outside the tournament, so nobody reads as a debut or a returner */
const recentHistory = [
  gameEvent("P1", "H1", before(5)),
  gameEvent("P2", "H1", before(6)),
  gameEvent("P3", "H1", before(7)),
  gameEvent("P4", "H1", before(8)),
];

describe("Tournament connections", () => {
  it("returns undefined until a game has been played", () => {
    expect(connections(baseEvents(["P1", "P2", "P3", "P4"]))).toBeUndefined();
  });

  it("splits the pairs into first meetings, reunions and regulars", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], undefined, ["H1"]),
      ...recentHistory,
      gameEvent("P1", "P2", before(9)), // Met recently
      gameEvent("P1", "P4", before(200)), // Met, but a long time ago
      ...bracketGames,
    ])!;

    expect(result.gamesPlayed).toBe(3);
    expect(result.playersPlayed).toBe(4);
    expect(result.pairs).toHaveLength(3);

    // P2 and P3 had never met
    expect(result.firstMeetings.map((meeting) => meeting.key)).toEqual(["P2|P3"]);
    expect(pair(result, "P2", "P3").gamesBefore).toBe(0);
    expect(pair(result, "P2", "P3").gap).toBeUndefined();

    // P1 and P4 had met, 200 days before the tournament started
    expect(result.reunions.map((meeting) => meeting.key)).toEqual(["P1|P4"]);
    expect(pair(result, "P1", "P4").gap).toBe(200 * ONE_DAY);
    expect(pair(result, "P1", "P4").gamesBefore).toBe(1);

    // P1 and P2 play each other regularly, so the tournament brought them nothing new
    expect(result.regulars).toBe(1);
    expect(pair(result, "P1", "P2").kind).toBe("regular");

    // The longest gap is reported even when it is also a reunion
    expect(result.longestGap?.key).toBe("P1|P4");
  });

  it("counts a pair that meets twice in the tournament as one meeting", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: true }, ["H1"]),
      ...recentHistory,
      gameEvent("P1", "P4", day(1)), // Winners semifinal
      gameEvent("P2", "P3", day(2)), // Winners semifinal
      gameEvent("P4", "P3", day(3)), // Losers round 1
      gameEvent("P1", "P2", day(4)), // Winners final
      gameEvent("P2", "P4", day(5)), // Losers final
      gameEvent("P1", "P2", day(6)), // Grand final: P1 and P2 meet for the second time
    ])!;

    expect(result.gamesPlayed).toBe(6);
    // Five distinct pairings out of six games
    expect(result.pairs).toHaveLength(5);
    expect(pair(result, "P1", "P2").gamesInTournament).toBe(2);
    expect(pair(result, "P1", "P2").kind).toBe("first-meeting");
    expect(result.firstMeetings.filter((meeting) => meeting.key === "P1|P2")).toHaveLength(1);
  });

  it("leaves out skipped games, since nobody met over them", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], undefined, ["H1"]),
      ...recentHistory,
      gameEvent("P1", "P4", day(1)),
      skipEvent("P2", "P3", day(2)), // P2 advances without playing
      gameEvent("P1", "P2", day(3)),
    ])!;

    expect(result.gamesPlayed).toBe(2);
    expect(result.pairs.map((meeting) => meeting.key).sort()).toEqual(["P1|P2", "P1|P4"]);
    // P3 never played, so the tournament says nothing about them
    expect(result.playersPlayed).toBe(3);
    expect(result.arrivals.some((candidate) => candidate.playerId === "P3")).toBe(false);
  });

  it("marks a player with no earlier games as a debut", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], undefined, ["H1"]),
      // P4 is left out of the history: the tournament is their first ever game
      gameEvent("P1", "H1", before(5)),
      gameEvent("P2", "H1", before(6)),
      gameEvent("P3", "H1", before(7)),
      ...bracketGames,
    ])!;

    const debut = arrival(result, "P4");
    expect(debut.debut).toBe(true);
    expect(debut.gamesBefore).toBe(0);
    expect(debut.lastPlayedAt).toBeUndefined();
    expect(debut.awayFor).toBeUndefined();
    expect(debut.gamesInTournament).toBe(1);
    // A debut already says it was their first tournament
    expect(debut.firstTournament).toBe(false);

    expect(arrival(result, "P1").debut).toBe(false);
    // Debuts are listed first
    expect(result.arrivals[0].playerId).toBe("P4");
  });

  it("marks a player who had not played in a long time as returning", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], undefined, ["H1"]),
      ...recentHistory.filter((event) => event.stream.includes("P4") === false),
      gameEvent("P4", "H1", before(300)), // P4 has been away for 300 days
      ...bracketGames,
    ])!;

    const returning = arrival(result, "P4");
    expect(returning.returning).toBe(true);
    expect(returning.debut).toBe(false);
    expect(returning.awayFor).toBe(300 * ONE_DAY);
    expect(returning.gamesBefore).toBe(1);

    expect(arrival(result, "P1").returning).toBe(false);
  });

  it("keeps a short break out of the returning list", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P3", "P4"], undefined, ["H1"]),
      ...recentHistory.filter((event) => event.stream.includes("P4") === false),
      gameEvent("P4", "H1", before(60)), // Away, but not for long enough to count
      ...bracketGames,
    ])!;

    expect(arrival(result, "P4").returning).toBe(false);
  });

  it("marks the players who had never been in a tournament before", () => {
    const result = connections([
      ...baseEvents(["P1", "P2", "P5", "P6"], undefined, ["H1", "H2"]),
      ...earlierTournament(["P1", "P2", "H1", "H2"], before(300)),
      // Everyone has played recently, so the only thing new is the tournament itself
      gameEvent("P1", "H1", before(5)),
      gameEvent("P2", "H1", before(6)),
      gameEvent("P5", "H1", before(7)),
      gameEvent("P6", "H1", before(8)),
      // Seeded P1, P2, P5, P6: the semifinals are P1 vs P6 and P2 vs P5
      gameEvent("P1", "P6", day(1)),
      gameEvent("P2", "P5", day(2)),
    ])!;

    expect(arrival(result, "P5").firstTournament).toBe(true);
    expect(arrival(result, "P6").firstTournament).toBe(true);
    // P1 and P2 played the earlier tournament, and nothing else about them is new
    expect(result.arrivals.map((candidate) => candidate.playerId).sort()).toEqual(["P5", "P6"]);
  });
});
