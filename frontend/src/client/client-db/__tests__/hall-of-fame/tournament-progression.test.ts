import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

const TOURNAMENT_ID = "tournament-1";
const START_DATE = 100_000; // Far in the past so the tournament has started

type BaseOptions = {
  doubleElimination?: boolean;
  groupPlay?: boolean;
  setPlayerOrder?: boolean;
  startDate?: number;
};

function baseEvents(players: string[], options?: BaseOptions): EventType[] {
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
      name: "Test tournament",
      startDate: options?.startDate ?? START_DATE,
      groupPlay: options?.groupPlay ?? false,
      doubleElimination: options?.doubleElimination ?? false,
    },
  });
  for (const player of players) {
    events.push({ time: time++, stream: TOURNAMENT_ID, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } });
  }
  if (options?.setPlayerOrder !== false) {
    events.push({
      time: time++,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
      data: { playerOrder: players },
    });
  }
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

function progression(events: EventType[], playerId: string) {
  const tennisTable = new TennisTable({ events });
  const entry = tennisTable.hallOfFame.getScoreForAnyPlayer(playerId);
  expect(entry).toBeDefined();
  return entry!.score.tournamentProgression;
}

beforeEach(() => {
  gameTime = 200_000;
});

const EIGHT = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"];

describe("Tournament progression scoring for tournaments in progress", () => {
  // 8 player single elimination, quarterfinals done, one semifinal played
  const inProgress = [
    ...baseEvents(EIGHT),
    gameEvent("P1", "P8"),
    gameEvent("P4", "P5"),
    gameEvent("P2", "P7"),
    gameEvent("P3", "P6"),
    gameEvent("P1", "P4"), // Semifinal 1
  ];

  it("scores a player by the round they have reached so far", () => {
    // P1 won their semifinal and stands in the pending final
    expect(progression(inProgress, "P1").tournaments).toEqual([
      { name: "Test tournament", placement: "Final", points: 200 },
    ]);
    // P2 won their quarterfinal and stands in the pending semifinal
    expect(progression(inProgress, "P2").tournaments).toEqual([
      { name: "Test tournament", placement: "Semi Finals", points: 100 },
    ]);
  });

  it("scores an eliminated player by the round they lost in", () => {
    expect(progression(inProgress, "P4").tournaments).toEqual([
      { name: "Test tournament", placement: "Semi Finals", points: 100 },
    ]);
    expect(progression(inProgress, "P8").tournaments).toEqual([
      { name: "Test tournament", placement: "Quarter Finals", points: 75 },
    ]);
  });

  it("gives no points for a tournament that has not started", () => {
    const future = baseEvents(EIGHT, { startDate: Date.now() + 1_000_000, setPlayerOrder: false });
    expect(progression(future, "P1").tournaments).toEqual([]);
  });

  it("gives participation points during group play", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4", "P5"], { groupPlay: true }),
      gameEvent("P1", "P5"),
      gameEvent("P2", "P4"),
    ];
    expect(progression(events, "P1").tournaments).toEqual([
      { name: "Test tournament", placement: "Participated", points: 25 },
    ]);
  });
});

describe("Tournament progression scoring without an explicitly set player order", () => {
  it("counts a tournament whose players come from signups", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3", "P4"], { setPlayerOrder: false }),
      gameEvent("P1", "P4"),
      gameEvent("P2", "P3"),
      gameEvent("P1", "P2"),
    ];
    expect(progression(events, "P1").tournaments).toEqual([
      { name: "Test tournament", placement: "Winner", points: 300 },
    ]);
    expect(progression(events, "P3").tournaments).toEqual([
      { name: "Test tournament", placement: "Semi Finals", points: 100 },
    ]);
  });
});

describe("Tournament progression scoring for double elimination", () => {
  // 8 players, played to completion. Losers bracket runs: P8 and P7 fight back
  const completed = [
    ...baseEvents(EIGHT, { doubleElimination: true }),
    // Winners round 1
    gameEvent("P1", "P8"),
    gameEvent("P4", "P5"),
    gameEvent("P2", "P7"),
    gameEvent("P3", "P6"),
    // Losers round 1
    gameEvent("P8", "P5"),
    gameEvent("P7", "P6"),
    // Winners semifinals
    gameEvent("P1", "P4"),
    gameEvent("P2", "P3"),
    // Losers round 2 (drop-ins cross-seeded)
    gameEvent("P8", "P3"),
    gameEvent("P7", "P4"),
    // Losers round 3
    gameEvent("P8", "P7"),
    // Winners final (first chance semi final)
    gameEvent("P1", "P2"),
    // Second chance semi final: P8 vs P2
    gameEvent("P2", "P8"),
    // Grand final
    gameEvent("P1", "P2"),
  ];

  it("awards semi final points (100) for reaching the second chance semi final", () => {
    expect(progression(completed, "P8").tournaments).toEqual([
      { name: "Test tournament", placement: "Second Chance Semi Final", points: 100 },
    ]);
  });

  it("awards the standard tiers to the rest of the field", () => {
    expect(progression(completed, "P1").tournaments).toEqual([
      { name: "Test tournament", placement: "Winner", points: 300 },
    ]);
    expect(progression(completed, "P2").tournaments).toEqual([
      { name: "Test tournament", placement: "Final", points: 200 },
    ]);
    // P7 lost losers round 3, one game short of the second chance semi final
    expect(progression(completed, "P7").tournaments).toEqual([
      { name: "Test tournament", placement: "Second Chance Bracket", points: 75 },
    ]);
    // P5 and P6 lost losers round 1
    expect(progression(completed, "P5").tournaments).toEqual([
      { name: "Test tournament", placement: "Second Chance Bracket", points: 50 },
    ]);
  });

  it("awards semi final points while standing in a pending second chance semi final", () => {
    // Everything played except the second chance semi final itself (and the grand final)
    const inProgress = completed.slice(0, -2);
    // P8 fought back through the losers bracket into the pending second chance semi final
    expect(progression(inProgress, "P8").tournaments).toEqual([
      { name: "Test tournament", placement: "Second Chance Semi Final", points: 100 },
    ]);
    // P2 lost the first chance semi final and dropped into the same pending game
    expect(progression(inProgress, "P2").tournaments).toEqual([
      { name: "Test tournament", placement: "Second Chance Semi Final", points: 100 },
    ]);
    // P1 won the first chance bracket and waits in the grand final
    expect(progression(inProgress, "P1").tournaments).toEqual([
      { name: "Test tournament", placement: "Final", points: 200 },
    ]);
  });
});
