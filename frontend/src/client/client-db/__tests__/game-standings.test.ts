import { Elo } from "../elo";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { eventsUpTo, eventsUpToByGameTime } from "../event-store/events-up-to";
import { determineSeason } from "../seasons/seasons";
import { TennisTable } from "../tennis-table";
import {
  expectedScoreChangeAroundGame,
  hallOfFameChangeAroundGame,
  hallOfFameScoreAt,
  playerStandingsAt,
  rankChange,
  scoreChange,
  seasonOfGame,
  statesAroundGame,
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

  it("has no place for a player who is not ranked, but keeps the Elo", () => {
    const unrankedState = new TennisTable({ events, gameLimitForRankedOverride: 10 });
    const standings = playerStandingsAt(unrankedState, "a", season1.start);
    expect(standings.leaderboardRank).toBeUndefined();
    // The player has played games, so the Elo has moved off the initial one.
    expect(standings.leaderboardScore).toBeDefined();
    expect(standings.leaderboardScore).not.toBe(Elo.INITIAL_ELO);
  });

  it("reads the Elo, which the winner gains and the loser loses", () => {
    const winnerBefore = playerStandingsAt(preState, "b", season1.start).leaderboardScore;
    const winnerAfter = playerStandingsAt(postState, "b", season1.start).leaderboardScore;
    const loserBefore = playerStandingsAt(preState, "a", season1.start).leaderboardScore;
    const loserAfter = playerStandingsAt(postState, "a", season1.start).leaderboardScore;
    expect(scoreChange(winnerBefore, winnerAfter)).toBeGreaterThan(0);
    // The game moves the same number of points from the loser to the winner.
    expect(scoreChange(loserBefore, loserAfter)).toBe(-(scoreChange(winnerBefore, winnerAfter) ?? 0));
  });

  it("starts a player with no game yet at the initial Elo", () => {
    const beforeAnyGame = new TennisTable({
      events: eventsUpTo(events, season1.start),
      referenceTime: season1.start,
    });
    expect(playerStandingsAt(beforeAnyGame, "a", season1.start).leaderboardScore).toBe(Elo.INITIAL_ELO);
  });

  it("reads the score and the place on the season leaderboard", () => {
    // A game without a score gives the winner 25 points for that pairing.
    expect(playerStandingsAt(preState, "b", season1.start)).toMatchObject({
      leaderboardRank: 2,
      seasonScore: 25,
      seasonRank: 2,
    });
    expect(playerStandingsAt(postState, "b", season1.start)).toMatchObject({
      leaderboardRank: 1,
      seasonScore: 50,
      seasonRank: 1,
    });
    // The loser keeps the 25 points won earlier, and drops one place.
    expect(playerStandingsAt(postState, "a", season1.start)).toMatchObject({
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

  it("has no standings at all for an unknown player", () => {
    expect(playerStandingsAt(postState, "unknown-player", season1.start)).toEqual({
      leaderboardRank: undefined,
      leaderboardScore: undefined,
      seasonScore: undefined,
      seasonRank: undefined,
    });
  });

  it("has no standings without a state", () => {
    expect(playerStandingsAt(undefined, "a", season1.start)).toEqual({
      leaderboardRank: undefined,
      leaderboardScore: undefined,
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
    const changes = hallOfFameChangeAroundGame(statesAroundGame(events, testedGameTime), ["b", "a"]);
    expect(changes.map((change) => change.playerId)).toEqual(["b", "a"]);
    expect(changes[0].after).toBeGreaterThan(changes[0].before ?? 0);
    expect(changes[1].before).toBeDefined();
    expect(changes[1].after).toBeDefined();
  });

  it("scores the state just before and just after the game", () => {
    const [change] = hallOfFameChangeAroundGame(statesAroundGame(events, testedGameTime), ["b"]);
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

describe("expectedScoreChangeAroundGame", () => {
  // Enough games for 2 ranked players at the default limit. D plays 1 game,
  // which is the game under test, and stays unranked.
  const pairEvents: EventType[] = [player("a", 1), player("b", 2), player("d", 3)];
  for (let i = 0; i < 12; i++) {
    const time = season1.start + (i + 1) * HOUR;
    pairEvents.push(i % 3 === 0 ? game(`p${i}`, time, "b", "a") : game(`p${i}`, time, "a", "b"));
  }
  const lastPairGame = season1.start + 12 * HOUR;
  const unrankedGame = season1.start + 13 * HOUR;
  pairEvents.push(game("u1", unrankedGame, "a", "d"));

  it("scores every given player before and after the game, in the given order", () => {
    const changes = expectedScoreChangeAroundGame(statesAroundGame(pairEvents, lastPairGame), ["b", "a"]);
    expect(changes.map((change) => change.playerId)).toEqual(["b", "a"]);
    for (const change of changes) {
      expect(change.before).toBeDefined();
      expect(change.after).toBeDefined();
    }
    // A wins the game, so the expected score of A goes up and that of B down.
    expect(changes[1].after!).toBeGreaterThan(changes[1].before!);
    expect(changes[0].after!).toBeLessThan(changes[0].before!);
  });

  it("reads the expected leaderboard of the state just before and just after the game", () => {
    const [change] = expectedScoreChangeAroundGame(statesAroundGame(pairEvents, lastPairGame), ["a"]);
    const expectedAt = (time: number) =>
      new TennisTable({ events: eventsUpTo(pairEvents, time), referenceTime: time }).simulations
        .expectedLeaderBoard()
        .expected.find((entry) => entry.id === "a")?.score;
    expect(change.before).toBe(expectedAt(lastPairGame - 1));
    expect(change.after).toBe(expectedAt(lastPairGame + 1));
  });

  it("has the given players in the calculation of both times", () => {
    // The second game of D. D is unranked at both times.
    const secondGame = unrankedGame + HOUR;
    const states = statesAroundGame([...pairEvents, game("u2", secondGame, "d", "a")], secondGame);
    const [change] = expectedScoreChangeAroundGame(states, ["a", "d"]);
    const withD = (state: TennisTable) =>
      state.simulations.expectedLeaderBoard("d").expected.find((entry) => entry.id === "a")?.score;
    expect(change.before).toBe(withD(states.before));
    expect(change.after).toBe(withD(states.after));
    expect(change.after!).toBeLessThan(change.before!);
  });

  it("adds an unranked player to the calculation, and has no score before their first game", () => {
    const [change] = expectedScoreChangeAroundGame(statesAroundGame(pairEvents, unrankedGame), ["d"]);
    expect(change.before).toBeUndefined();
    expect(change.after).toBeDefined();
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

describe("eventsUpToByGameTime", () => {
  const score = (gameId: string, time: number, gameWinner: number, gameLoser: number): EventType => ({
    time,
    stream: gameId,
    type: EventTypeEnum.GAME_SCORE,
    data: { setsWon: { gameWinner, gameLoser } },
  });
  const playedAt = season1.start + HOUR;
  const otherGameTime = playedAt + 5_000;
  const base: EventType[] = [player("a", 1), player("b", 2), player("c", 3), game("g1", playedAt, "a", "b")];
  const scoreIn = (state: TennisTable, gameId = "g1") => state.games.find((g) => g.id === gameId)?.score?.setsWon;

  it("keeps a score stored 1 ms after the game", () => {
    const events = [...base, score("g1", playedAt + 1, 2, 0)];
    expect(eventsUpToByGameTime(events, playedAt + 1)).toEqual(events);
    expect(eventsUpToByGameTime(events, playedAt - 1)).toEqual(base.slice(0, 3));
  });

  it("counts a late score at the time of its game, and leaves later events out", () => {
    const events = [
      ...base,
      player("d", playedAt + 2_000),
      game("g2", otherGameTime, "c", "a"),
      score("g2", otherGameTime + 1, 2, 1),
      score("g1", otherGameTime + 10_000, 2, 0),
    ];
    expect(eventsUpToByGameTime(events, playedAt + 1).map((event) => event.stream)).toEqual([
      "a",
      "b",
      "c",
      "g1",
      "g1",
    ]);
  });

  it("uses the last score when the score was changed later", () => {
    const events = [...base, score("g1", playedAt + 1, 2, 0), score("g1", playedAt + 60_000, 3, 1)];
    const state = new TennisTable({ events: eventsUpToByGameTime(events, playedAt + 1) });
    expect(scoreIn(state)).toEqual({ gameWinner: 3, gameLoser: 1 });
  });

  it("matches a score to its game by id, not by the time it was played", () => {
    const events = [...base, game("g2", playedAt + 2, "c", "a"), score("g2", otherGameTime, 2, 0)];
    expect(eventsUpToByGameTime(events, playedAt + 1).map((event) => event.stream)).toEqual(["a", "b", "c", "g1"]);
  });

  it("gives a game the late score of an earlier game in its before and after states", () => {
    const events = [...base, game("g2", otherGameTime, "c", "a"), score("g1", otherGameTime + 1, 2, 0)];
    const first = statesAroundGame(events, playedAt);
    const second = statesAroundGame(events, otherGameTime);
    expect(first.before.games.find((g) => g.id === "g1")).toBeUndefined();
    expect(scoreIn(first.after)).toEqual({ gameWinner: 2, gameLoser: 0 });
    expect(first.after.games.find((g) => g.id === "g2")).toBeUndefined();
    expect(scoreIn(second.before)).toEqual({ gameWinner: 2, gameLoser: 0 });
    expect(scoreIn(second.after)).toEqual({ gameWinner: 2, gameLoser: 0 });
  });
});
