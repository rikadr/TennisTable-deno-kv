import { EventType, EventTypeEnum } from "../event-store/event-types";
import { eventsUpTo } from "../event-store/events-up-to";
import { determineSeason } from "../seasons/seasons";
import { TennisTable } from "../tennis-table";
import {
  hallOfFameChangeAroundGame,
  hallOfFameScoreAt,
  playerStandingsAt,
  rankChange,
  scoreChange,
  seasonOfGame,
} from "../game-standings";

const HOUR = 60 * 60 * 1000;

const season1 = determineSeason(new Date(2024, 0, 15).getTime());
const season2 = determineSeason(new Date(2024, 4, 15).getTime());

const player = (id: string, time: number): EventType => ({
  time,
  stream: id,
  type: EventTypeEnum.PLAYER_CREATED,
  data: { name: id.toUpperCase() },
});

const game = (id: string, time: number, winner: string, loser: string): EventType => ({
  time,
  stream: id,
  type: EventTypeEnum.GAME_CREATED,
  data: { playedAt: time, winner, loser },
});

// A beats C, B beats C, then B beats A. The last game is the one under test:
// it swaps A and B on both the overall leaderboard and the season leaderboard.
const testedGameTime = season1.start + 3 * HOUR;
const events: EventType[] = [
  player("a", 1),
  player("b", 2),
  player("c", 3),
  game("g1", season1.start + HOUR, "a", "c"),
  game("g2", season1.start + 2 * HOUR, "b", "c"),
  game("g3", testedGameTime, "b", "a"),
];

// Every player is ranked from the first game, so the overall leaderboard has
// all three of them.
function stateAt(time: number): TennisTable {
  return new TennisTable({
    events: eventsUpTo(events, time),
    referenceTime: time,
    gameLimitForRankedOverride: 1,
  });
}

const preState = stateAt(testedGameTime - 1);
const postState = stateAt(testedGameTime + 1);
const liveState = new TennisTable({ events, gameLimitForRankedOverride: 1 });

describe("seasonOfGame", () => {
  it("returns the season that the game counts towards, and its number", () => {
    expect(seasonOfGame(liveState, testedGameTime)).toEqual({ start: season1.start, number: 1 });
  });

  it("numbers the seasons in the order they are played", () => {
    const twoSeasons = new TennisTable({
      events: [...events, game("g4", season2.start + HOUR, "a", "b")],
    });
    expect(seasonOfGame(twoSeasons, season2.start + HOUR)).toEqual({ start: season2.start, number: 2 });
  });

  it("returns no season for a game in the break between two seasons", () => {
    const breakTime = season1.end + HOUR;
    const withBreakGame = new TennisTable({ events: [...events, game("g4", breakTime, "a", "b")] });
    expect(seasonOfGame(withBreakGame, breakTime)).toBeUndefined();
  });
});

describe("playerStandingsAt", () => {
  it("reads the place on the overall leaderboard", () => {
    // A leads on Elo before the game, and B takes the lead by winning it.
    expect(playerStandingsAt(preState, "a", season1.start).leaderboardRank).toBe(1);
    expect(playerStandingsAt(preState, "b", season1.start).leaderboardRank).toBe(2);
    expect(playerStandingsAt(postState, "b", season1.start).leaderboardRank).toBe(1);
    expect(playerStandingsAt(postState, "a", season1.start).leaderboardRank).toBe(2);
  });

  it("has no place for a player who is not ranked", () => {
    const unrankedState = new TennisTable({ events, gameLimitForRankedOverride: 10 });
    expect(playerStandingsAt(unrankedState, "a", season1.start).leaderboardRank).toBeUndefined();
  });

  it("reads the score and the place on the season leaderboard", () => {
    // A game without a score gives the winner 25 points for that pairing.
    expect(playerStandingsAt(preState, "b", season1.start)).toEqual({
      leaderboardRank: 2,
      seasonScore: 25,
      seasonRank: 2,
    });
    expect(playerStandingsAt(postState, "b", season1.start)).toEqual({
      leaderboardRank: 1,
      seasonScore: 50,
      seasonRank: 1,
    });
    // The loser keeps the 25 points won earlier, and drops one place.
    expect(playerStandingsAt(postState, "a", season1.start)).toEqual({
      leaderboardRank: 2,
      seasonScore: 25,
      seasonRank: 2,
    });
  });

  it("has no season score when the game counts towards no season", () => {
    const standings = playerStandingsAt(postState, "b", undefined);
    expect(standings.seasonScore).toBeUndefined();
    expect(standings.seasonRank).toBeUndefined();
    expect(standings.leaderboardRank).toBe(1);
  });

  it("has no season score for a player with no game in the season", () => {
    const standings = playerStandingsAt(postState, "d", season1.start);
    expect(standings).toEqual({ leaderboardRank: undefined, seasonScore: undefined, seasonRank: undefined });
  });

  it("has no standings without a state", () => {
    expect(playerStandingsAt(undefined, "a", season1.start)).toEqual({
      leaderboardRank: undefined,
      seasonScore: undefined,
      seasonRank: undefined,
    });
  });
});

describe("hallOfFameScoreAt", () => {
  it("grows for the player who wins the game", () => {
    const before = hallOfFameScoreAt(preState, "b");
    const after = hallOfFameScoreAt(postState, "b");
    expect(before).toBeDefined();
    expect(after).toBeDefined();
    expect(after).toBeGreaterThan(before ?? 0);
  });

  it("has no score for an unknown player, and none without a state", () => {
    expect(hallOfFameScoreAt(postState, "unknown-player")).toBeUndefined();
    expect(hallOfFameScoreAt(undefined, "b")).toBeUndefined();
  });
});

describe("hallOfFameChangeAroundGame", () => {
  it("scores every given player before and after the game, in the given order", () => {
    const changes = hallOfFameChangeAroundGame(events, testedGameTime, ["b", "a"]);
    expect(changes.map((change) => change.playerId)).toEqual(["b", "a"]);
    expect(changes[0].after).toBeGreaterThan(changes[0].before ?? 0);
    expect(changes[1].before).toBeDefined();
    expect(changes[1].after).toBeDefined();
  });

  it("scores the state just before and just after the game", () => {
    const [change] = hallOfFameChangeAroundGame(events, testedGameTime, ["b"]);
    const stateWithoutGame = new TennisTable({
      events: eventsUpTo(events, testedGameTime - 1),
      referenceTime: testedGameTime - 1,
    });
    const stateWithGame = new TennisTable({
      events: eventsUpTo(events, testedGameTime + 1),
      referenceTime: testedGameTime + 1,
    });
    expect(change.before).toBe(hallOfFameScoreAt(stateWithoutGame, "b"));
    expect(change.after).toBe(hallOfFameScoreAt(stateWithGame, "b"));
    expect(change.after).not.toBe(change.before);
  });
});

describe("scoreChange", () => {
  it("is the difference between the two scores", () => {
    expect(scoreChange(25, 50)).toBe(25);
    expect(scoreChange(50, 25)).toBe(-25);
  });

  it("counts a missing side as the given score", () => {
    expect(scoreChange(undefined, 50, 0)).toBe(50);
    expect(scoreChange(50, undefined, 0)).toBe(-50);
  });

  it("is unknown when a side is missing and has no given score", () => {
    expect(scoreChange(undefined, 50)).toBeUndefined();
    expect(scoreChange(50, undefined)).toBeUndefined();
  });
});

describe("rankChange", () => {
  it("counts the places gained, so a move up is positive", () => {
    expect(rankChange(2, 1)).toBe(1);
    expect(rankChange(1, 2)).toBe(-1);
    expect(rankChange(3, 3)).toBe(0);
  });

  it("is unknown when the player has no place on one of the two sides", () => {
    expect(rankChange(undefined, 1)).toBeUndefined();
    expect(rankChange(1, undefined)).toBeUndefined();
  });
});
