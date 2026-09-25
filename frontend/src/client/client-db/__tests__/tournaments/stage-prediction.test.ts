import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import {
  chanceBeyond,
  mostFrequentStage,
  stagesInColumn,
  TournamentStagePredictionResult,
} from "../../tournaments/stage-prediction";

const TOURNAMENT_ID = "tournament-1";
const START_DATE = 100_000;
const SIMULATIONS = 200;

function baseEvents(players: string[], options: { doubleElimination?: boolean; groupPlay?: boolean }): EventType[] {
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
      name: "Stage prediction test",
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

function predict(events: EventType[]): TournamentStagePredictionResult {
  const tennisTable = new TennisTable({ events });
  return tennisTable.tournaments.stagePrediction.predictStages(TOURNAMENT_ID, SIMULATIONS);
}

function total(counts: Partial<Record<string, number>>): number {
  return Object.values(counts).reduce((sum: number, count) => sum + (count ?? 0), 0);
}

beforeEach(() => {
  gameTime = 200_000;
});

describe("Tournament stage prediction", () => {
  it("gives every single elimination player one knocked out stage per simulation", () => {
    const result = predict(baseEvents(["A", "B", "C", "D"], {}));

    expect(result.simulations).toBe(SIMULATIONS);
    expect(Object.keys(result.players).sort()).toEqual(["A", "B", "C", "D"]);
    let winners = 0;
    for (const counts of Object.values(result.players)) {
      expect(total(counts.knockedOut)).toBe(SIMULATIONS);
      expect(total(counts.firstChance)).toBe(0);
      for (const stage of Object.keys(counts.knockedOut)) {
        expect(["winner", "final", "bracket:1"]).toContain(stage);
      }
      winners += counts.knockedOut.winner ?? 0;
    }
    expect(winners).toBe(SIMULATIONS);
  });

  it("gives a player who is already knocked out their stage in every simulation", () => {
    // Player order A, B, C, D: the semi finals are A vs D and B vs C
    const result = predict([...baseEvents(["A", "B", "C", "D"], {}), gameEvent("A", "D")]);

    expect(result.players.D.knockedOut).toEqual({ "bracket:1": SIMULATIONS });
    expect(result.decided.D).toEqual({ knockedOut: "bracket:1" });
    expect(result.decided.A).toBeUndefined();
    expect(result.players.A.knockedOut["bracket:1"]).toBeUndefined();
  });

  it("gives the result of an ended tournament at 100%", () => {
    const result = predict([
      ...baseEvents(["A", "B", "C", "D"], {}),
      gameEvent("A", "D"),
      gameEvent("C", "B"),
      gameEvent("C", "A"),
    ]);

    expect(result.players.C.knockedOut).toEqual({ winner: SIMULATIONS });
    expect(result.players.A.knockedOut).toEqual({ final: SIMULATIONS });
    expect(result.players.B.knockedOut).toEqual({ "bracket:1": SIMULATIONS });
    expect(result.decided.C).toEqual({ knockedOut: "winner" });
  });

  it("gives every double elimination player a first chance stage and a knocked out stage", () => {
    const result = predict(baseEvents(["A", "B", "C", "D"], { doubleElimination: true }));

    expect(result.doubleElimination).toBe(true);
    expect(result.winnersLayerCount).toBe(2);
    expect(result.losersLayerCount).toBe(2);
    let winners = 0;
    let firstChanceWinners = 0;
    for (const counts of Object.values(result.players)) {
      expect(total(counts.knockedOut)).toBe(SIMULATIONS);
      expect(total(counts.firstChance)).toBe(SIMULATIONS);
      for (const stage of Object.keys(counts.knockedOut)) {
        expect(["winner", "final", "second:0", "second:1"]).toContain(stage);
      }
      for (const stage of Object.keys(counts.firstChance)) {
        expect(["final", "bracket:0", "bracket:1"]).toContain(stage);
      }
      winners += counts.knockedOut.winner ?? 0;
      firstChanceWinners += counts.firstChance.final ?? 0;
    }
    expect(winners).toBe(SIMULATIONS);
    expect(firstChanceWinners).toBe(SIMULATIONS);
  });

  it("counts a loss in the final decider as the final", () => {
    // First chance: A beats D, B beats C, A beats B. Second chance: D beats C, B beats D.
    // Final: B beats A, so the final decider is played. A wins it.
    const result = predict([
      ...baseEvents(["A", "B", "C", "D"], { doubleElimination: true }),
      gameEvent("A", "D"),
      gameEvent("B", "C"),
      gameEvent("A", "B"),
      gameEvent("D", "C"),
      gameEvent("B", "D"),
      gameEvent("B", "A"),
      gameEvent("A", "B"),
    ]);

    expect(result.decided.A).toEqual({ firstChance: "final", knockedOut: "winner" });
    expect(result.decided.B).toEqual({ firstChance: "bracket:0", knockedOut: "final" });
    expect(result.decided.D).toEqual({ firstChance: "bracket:1", knockedOut: "second:0" });
    expect(result.decided.C).toEqual({ firstChance: "bracket:1", knockedOut: "second:1" });
  });

  it("gives players who do not qualify from group play their place in the total standings", () => {
    // 10 players: 2 groups of 5, the bracket takes the best 8 of the total standings
    const players = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const result = predict(baseEvents(players, { groupPlay: true }));

    const groupStages = new Map<string, number>();
    for (const counts of Object.values(result.players)) {
      expect(total(counts.knockedOut)).toBe(SIMULATIONS);
      for (const [stage, count] of Object.entries(counts.knockedOut)) {
        if (stage.startsWith("group:")) groupStages.set(stage, (groupStages.get(stage) ?? 0) + (count ?? 0));
      }
    }
    expect(Object.fromEntries(groupStages)).toEqual({ "group:9": SIMULATIONS, "group:10": SIMULATIONS });
  });

  it("gives the decided standings place when group play has ended", () => {
    // 5 players in 1 group. E loses all games and ends 5th, below the 4 bracket places
    const players = ["A", "B", "C", "D", "E"];
    const groupGames = [
      gameEvent("A", "B"),
      gameEvent("A", "C"),
      gameEvent("A", "D"),
      gameEvent("A", "E"),
      gameEvent("B", "C"),
      gameEvent("B", "D"),
      gameEvent("B", "E"),
      gameEvent("C", "D"),
      gameEvent("C", "E"),
      gameEvent("D", "E"),
    ];
    const result = predict([...baseEvents(players, { groupPlay: true }), ...groupGames]);

    expect(result.decided.E).toEqual({ knockedOut: "group:5", firstChance: undefined });
    expect(result.players.E.knockedOut).toEqual({ "group:5": SIMULATIONS });
  });

  it("gives a group stage in both columns for double elimination with group play", () => {
    const result = predict(baseEvents(["A", "B", "C", "D", "E"], { groupPlay: true, doubleElimination: true }));

    for (const counts of Object.values(result.players)) {
      expect(total(counts.firstChance)).toBe(SIMULATIONS);
      expect(counts.firstChance["group:5"]).toBe(counts.knockedOut["group:5"]);
    }
  });
});

describe("Stage helpers", () => {
  it("picks the most frequent stage, and the later stage on a tie", () => {
    expect(mostFrequentStage({ "bracket:1": 30, final: 30, winner: 10 })).toBe("final");
    expect(mostFrequentStage({ "bracket:2": 50, "bracket:1": 20 })).toBe("bracket:2");
    expect(mostFrequentStage({})).toBeUndefined();
  });

  it("calculates the chance to get further than a stage", () => {
    expect(chanceBeyond({ "bracket:1": 50, final: 30, winner: 20 }, "bracket:1", 100)).toBeCloseTo(0.5);
    expect(chanceBeyond({ "group:3": 40, "bracket:2": 60 }, "group:3", 100)).toBeCloseTo(0.6);
  });

  it("lists the stages of a column with the latest stage first", () => {
    const result: TournamentStagePredictionResult = {
      simulations: 10,
      doubleElimination: false,
      winnersLayerCount: 3,
      losersLayerCount: 0,
      players: {
        A: { knockedOut: { "bracket:2": 5, "group:4": 5 }, firstChance: {} },
        B: { knockedOut: { "bracket:1": 10 }, firstChance: {} },
      },
      decided: {},
    };
    expect(stagesInColumn(result, "knockedOut")).toEqual(["winner", "final", "bracket:1", "bracket:2", "group:4"]);
  });
});
