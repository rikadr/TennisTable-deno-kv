import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

// Default GuestClient has gameLimitForRanked = 5.
const T0 = 1_000_000;

function buildTennisTable(games: [winner: string, loser: string][]): TennisTable {
  const players = Array.from(new Set(games.flat()));
  const events: EventType[] = players.map((p, i) => ({
    time: 1000 + i,
    stream: p,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: p },
  }));
  games.forEach(([winner, loser], i) => {
    events.push({
      time: T0 + i,
      stream: `game-${i}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt: T0 + i, winner, loser },
    });
  });
  return new TennisTable({ events, referenceTime: T0 + games.length });
}

const repeat = (game: [string, string], times: number): [string, string][] => Array.from({ length: times }, () => game);

// A, B and C are ranked. D is unranked and gave 3 wins worth of points to A,
// so the points pool of the ranked players is larger than 3 x 1000.
const games: [string, string][] = [
  ...repeat(["A", "B"], 4),
  ...repeat(["B", "A"], 2),
  ...repeat(["B", "C"], 4),
  ...repeat(["C", "B"], 2),
  ...repeat(["A", "C"], 3),
  ...repeat(["C", "A"], 3),
  ...repeat(["A", "D"], 3),
];

const sum = (scores: { score: number }[]) => scores.reduce((acc, cur) => acc + cur.score, 0);

describe("Simulations.expectedLeaderBoard", () => {
  it("keeps the points pool of the ranked players", () => {
    const tennisTable = buildTennisTable(games);
    const { current, expected } = tennisTable.simulations.expectedLeaderBoard(undefined, undefined, 20);

    expect(current.map((p) => p.id).sort()).toEqual(["A", "B", "C"]);
    expect(sum(current)).toBeGreaterThan(3 * 1000);
    expect(sum(expected)).toBeCloseTo(sum(current), 6);
  });

  it("adds the score of the included unranked player to the pool", () => {
    const tennisTable = buildTennisTable(games);
    const { current, expected } = tennisTable.simulations.expectedLeaderBoard(undefined, "D", 20);
    const unrankedScore = tennisTable.leaderboard.getCachedLeaderboardMap().get("D")!.elo;

    expect(expected.map((p) => p.id).sort()).toEqual(["A", "B", "C", "D"]);
    expect(sum(expected)).toBeCloseTo(sum(current) + unrankedScore, 6);
  });
});
