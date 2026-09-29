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
    const { current, expected } = tennisTable.simulations.expectedLeaderBoard();

    expect(current.map((p) => p.id).sort()).toEqual(["A", "B", "C"]);
    expect(sum(current)).toBeGreaterThan(3 * 1000);
    expect(sum(expected)).toBeCloseTo(sum(current), 6);
  });

  it("adds the score of the included unranked player to the pool", () => {
    const tennisTable = buildTennisTable(games);
    const { current, expected } = tennisTable.simulations.expectedLeaderBoard("D");
    const unrankedScore = tennisTable.leaderboard.getCachedLeaderboardMap().get("D")!.elo;

    expect(expected.map((p) => p.id).sort()).toEqual(["A", "B", "C", "D"]);
    expect(sum(expected)).toBeCloseTo(sum(current) + unrankedScore, 6);
  });

  it("gives the same result each time", () => {
    const tennisTable = buildTennisTable(games);

    expect(tennisTable.simulations.expectedLeaderBoard()).toEqual(tennisTable.simulations.expectedLeaderBoard());
  });

  it("does not favour the players who played first", () => {
    // Each pair has a 5-5 record, so each player has the same expected score.
    const evenGames: [string, string][] = [];
    for (let i = 0; i < 5; i++) evenGames.push(["A", "B"], ["B", "A"], ["B", "C"], ["C", "B"], ["C", "A"], ["A", "C"]);
    const { current, expected } = buildTennisTable(evenGames).simulations.expectedLeaderBoard();

    expect(expected).toHaveLength(3);
    for (const player of expected) expect(player.score).toBeCloseTo(sum(current) / 3, 3);
  });
});

describe("Simulations.expectedPlayerEloOverTime", () => {
  // A and B share a 5-5 record, then A beats the unranked D 4 times.
  const alternating: [string, string][] = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? ["A", "B"] : ["B", "A"]));
  const overTimeGames: [string, string][] = [...alternating, ...repeat(["A", "D"], 4)];

  const expectedOverTime = (tennisTable: TennisTable, playerId: string) => {
    const elements: { elo: number; time: number }[] = [];
    tennisTable.simulations.expectedPlayerEloOverTime(playerId, (message) => elements.push(...message.elements));
    return elements;
  };

  it("gives no expected score at a time when the player is not in the calculation", () => {
    const elements = expectedOverTime(buildTennisTable(overTimeGames), "A");

    // A and B have 5 games each after the game at T0 + 4.
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.every((element) => element.time >= T0 + 4)).toBe(true);
  });

  it("uses the points pool at that time", () => {
    const tennisTable = buildTennisTable(overTimeGames);
    const leaderboardMap = tennisTable.leaderboard.getCachedLeaderboardMap();
    const pool = leaderboardMap.get("A")!.elo + leaderboardMap.get("B")!.elo;
    const latest = expectedOverTime(tennisTable, "A").find(
      (element) => element.time === T0 + overTimeGames.length - 1,
    )!;

    // A 50/50 record splits the pool of A and B evenly.
    expect(pool).toBeGreaterThan(2 * 1000 + 20);
    expect(latest.elo).toBeCloseTo(pool / 2, 3);
  });
});
