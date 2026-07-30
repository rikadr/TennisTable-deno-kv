import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

let time = 0;
const nextTime = () => ++time;

function player(id: string): EventType {
  return { time: nextTime(), stream: id, type: EventTypeEnum.PLAYER_CREATED, data: { name: id } };
}

function game(winner: string, loser: string): EventType {
  const playedAt = nextTime();
  return {
    time: playedAt,
    stream: `game-${winner}-${loser}-${playedAt}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  };
}

describe("PlayerOponentDistribution", () => {
  beforeEach(() => {
    time = 0;
  });

  it("returns an empty distribution for a player with no games", () => {
    const events = [player("me"), player("a"), player("b"), game("a", "b")];

    expect(new TennisTable({ events }).playerOponentDistribution.get("me")).toEqual({
      avgDiff: 0,
      diffGraphData: [],
    });
  });

  it("returns an empty distribution for a player that does not exist", () => {
    const events = [player("a"), player("b"), game("a", "b")];

    expect(new TennisTable({ events }).playerOponentDistribution.get("nobody")).toEqual({
      avgDiff: 0,
      diffGraphData: [],
    });
  });

  it("averages the score difference of the opponents a player has met", () => {
    const events = [player("me"), player("a"), game("me", "a"), game("a", "me")];

    const { avgDiff, diffGraphData } = new TennisTable({ events }).playerOponentDistribution.get("me");

    // Both games are against an opponent who starts on the same elo, so the first game is an even
    // matchup and the second is played against an opponent that just lost points.
    expect(avgDiff).toBeLessThan(0);
    expect(diffGraphData.reduce((sum, entry) => sum + entry.count, 0)).toBe(2);
  });
});
