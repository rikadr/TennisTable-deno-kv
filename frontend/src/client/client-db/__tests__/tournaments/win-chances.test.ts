import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TournamentBracket } from "../../tournaments/bracket";
import { PredictGameFn, SimulateGameFn } from "../../tournaments/tournament";

const TOURNAMENT_ID = "tournament-1";
const START_DATE = 100_000; // Far in the past so the tournament has started

function tournamentEvents(
  players: string[],
  options: { groupPlay?: boolean; doubleElimination?: boolean } = {},
): EventType[] {
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
      name: "Win chance test",
      startDate: START_DATE,
      groupPlay: options.groupPlay ?? false,
      doubleElimination: options.doubleElimination ?? false,
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

beforeEach(() => {
  gameTime = 200_000;
});

const players = ["P1", "P2", "P3", "P4"];
// The player in the player1 slot always has a 60% chance
const player1At60: PredictGameFn = () => ({ player1Wins: 0.6, confidence: 1 });

describe("TournamentBracket win chances", () => {
  it("calculates the chances of a new bracket", () => {
    // The semi finals are P1 vs P4 and P2 vs P3. The winner of P1 vs P4 is player1 in the final
    const { chances, gamesCount, confidenceSum } = TournamentBracket.winChancesFromStatic(player1At60, players);

    expect(chances.get("P1")).toBeCloseTo(0.6 * 0.6, 10);
    expect(chances.get("P4")).toBeCloseTo(0.4 * 0.6, 10);
    expect(chances.get("P2")).toBeCloseTo(0.6 * 0.4, 10);
    expect(chances.get("P3")).toBeCloseTo(0.4 * 0.4, 10);
    expect(gamesCount).toBe(3);
    expect(confidenceSum).toBeCloseTo(3, 10);
  });

  it("uses the played games of an existing bracket", () => {
    const tennisTable = new TennisTable({ events: [...tournamentEvents(players), gameEvent("P4", "P1")] });
    const bracket = tennisTable.tournaments.getTournament(TOURNAMENT_ID)!.bracket!;

    const { chances, gamesCount } = bracket.winChancesFromExisting(player1At60);

    expect(chances.has("P1")).toBe(false);
    expect(chances.get("P4")).toBeCloseTo(0.6, 10);
    expect(chances.get("P2")).toBeCloseTo(0.6 * 0.4, 10);
    expect(chances.get("P3")).toBeCloseTo(0.4 * 0.4, 10);
    expect(gamesCount).toBe(2);
  });

  it("gives the same chances as many simulations, with byes", () => {
    const sixPlayers = ["A", "B", "C", "D", "E", "F"];
    const strength = new Map(sixPlayers.map((player, index) => [player, 6 - index]));
    const predictGameFn: PredictGameFn = (player1, player2) => ({
      player1Wins: strength.get(player1)! / (strength.get(player1)! + strength.get(player2)!),
      confidence: 1,
    });
    let seed = 42;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const simulateGameFn: SimulateGameFn = (player1, player2) => {
      const player1Wins = random() < predictGameFn(player1, player2).player1Wins;
      return { winner: player1Wins ? player1 : player2, loser: player1Wins ? player2 : player1, confidence: 1 };
    };

    const { chances } = TournamentBracket.winChancesFromStatic(predictGameFn, sixPlayers);
    const simulations = 200_000;
    const wins = new Map<string, number>();
    for (let i = 0; i < simulations; i++) {
      const { winner } = TournamentBracket.simulateWinnerFromStatic(simulateGameFn, 0, sixPlayers);
      wins.set(winner, (wins.get(winner) ?? 0) + 1);
    }

    for (const player of sixPlayers) {
      // 5 standard errors of the simulated fraction
      expect(Math.abs((wins.get(player) ?? 0) / simulations - chances.get(player)!)).toBeLessThan(0.006);
    }
    const total = Array.from(chances.values()).reduce((sum, chance) => sum + chance, 0);
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("Tournament win chances", () => {
  const predict = (events: EventType[]) => {
    const tennisTable = new TennisTable({ events });
    const tournament = tennisTable.tournaments.getTournament(TOURNAMENT_ID)!;
    return tournament.predictWinChances(tennisTable, START_DATE + 1);
  };

  it("is exact for a single elimination bracket", () => {
    const { chances, method } = predict(tournamentEvents(players));
    const total = Array.from(chances.values()).reduce((sum, chance) => sum + chance, 0);

    expect(method).toBe("exact");
    expect(chances.size).toBe(4);
    expect(total).toBeCloseTo(1, 10);
  });

  it("simulates the group play once and calculates the bracket exactly", () => {
    const { chances, method } = predict(tournamentEvents(["P1", "P2", "P3", "P4", "P5", "P6"], { groupPlay: true }));
    const total = Array.from(chances.values()).reduce((sum, chance) => sum + chance, 0);

    expect(method).toBe("hybrid");
    // 4 players advance from the group play
    expect(chances.size).toBe(4);
    expect(total).toBeCloseTo(1, 10);
  });

  it("simulates a double elimination bracket once", () => {
    const { chances, method } = predict(tournamentEvents(players, { doubleElimination: true }));

    expect(method).toBe("simulation");
    expect(chances.size).toBe(1);
    expect(Array.from(chances.values())).toEqual([1]);
  });

  it("uses 25 times fewer samples for a hybrid prediction", () => {
    const events = tournamentEvents(["P1", "P2", "P3", "P4", "P5", "P6"], { groupPlay: true });
    const tennisTable = new TennisTable({ events });
    const results: { simulations: number; method: string }[] = [];
    tennisTable.tournaments.tournamentPrediction.predictTournament(
      TOURNAMENT_ID,
      (data) => data.data && results.push(data.data),
      5_000,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.method === "hybrid" && result.simulations === 200)).toBe(true);
  });

  it("gives an exact prediction from 1 calculation", () => {
    const events = tournamentEvents(players);
    const tennisTable = new TennisTable({ events });
    const results: { simulations: number; method: string }[] = [];
    tennisTable.tournaments.tournamentPrediction.predictTournament(
      TOURNAMENT_ID,
      (data) => data.data && results.push(data.data),
      5_000,
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((result) => result.method === "exact" && result.simulations === 1)).toBe(true);
  });
});
