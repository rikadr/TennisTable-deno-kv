import { EventType } from "./event-store/event-types";
import { eventsUpTo } from "./event-store/events-up-to";
import { TennisTable } from "./tennis-table";

/**
 * Where a player stands in a projected state, in the values that a single
 * game can move. A value is undefined when the player is not on that
 * leaderboard at that time.
 */
export type PlayerStandings = {
  /** The place on the overall leaderboard. Undefined for an unranked player. */
  leaderboardRank: number | undefined;
  /** The score on the leaderboard of the season the game counts towards. */
  seasonScore: number | undefined;
  /** The place on that same season leaderboard. */
  seasonRank: number | undefined;
};

/** The season a game counts towards, and its number in the list of seasons. */
export type GameSeason = { start: number; number: number };

/**
 * The season that a game counts towards: the season whose window contains the
 * time the game was played. A game in the break between two seasons counts
 * towards no season, and then this returns undefined.
 */
export function seasonOfGame(state: TennisTable, playedAt: number): GameSeason | undefined {
  const seasons = state.seasons.getSeasons();
  const index = seasons.findIndex((season) => playedAt >= season.start && playedAt < season.end);
  if (index === -1) return undefined;
  return { start: seasons[index].start, number: index + 1 };
}

/** The standings of one player in one projected state. */
export function playerStandingsAt(
  state: TennisTable | undefined,
  playerId: string,
  seasonStart: number | undefined,
): PlayerStandings {
  const standings: PlayerStandings = {
    leaderboardRank: undefined,
    seasonScore: undefined,
    seasonRank: undefined,
  };
  if (!state) return standings;

  standings.leaderboardRank = state.leaderboard
    .getLeaderboard()
    .rankedPlayers.find((player) => player.id === playerId)?.rank;

  if (seasonStart === undefined) return standings;
  const season = state.seasons.getSeasons().find((s) => s.start === seasonStart);
  if (!season) return standings;

  const seasonLeaderboard = season.getLeaderboard();
  const index = seasonLeaderboard.findIndex((player) => player.playerId === playerId);
  if (index !== -1) {
    standings.seasonScore = seasonLeaderboard[index].seasonScore;
    standings.seasonRank = index + 1;
  }
  return standings;
}

/** The Hall of Fame score of one player in one projected state. */
export function hallOfFameScoreAt(state: TennisTable | undefined, playerId: string): number | undefined {
  return state?.hallOfFame.getScoreForAnyPlayer(playerId)?.score.total;
}

/** The Hall of Fame score of one player just before and just after a game. */
export type HallOfFameChange = { playerId: string; before: number | undefined; after: number | undefined };

/**
 * The Hall of Fame score of each player just before and just after a game. It
 * scores every achievement of every player twice, which takes seconds on a
 * long history, so it runs in a web worker.
 */
export function hallOfFameChangeAroundGame(
  events: EventType[],
  playedAt: number,
  playerIds: string[],
): HallOfFameChange[] {
  const before = new TennisTable({ events: eventsUpTo(events, playedAt - 1), referenceTime: playedAt - 1 });
  const after = new TennisTable({ events: eventsUpTo(events, playedAt + 1), referenceTime: playedAt + 1 });
  return playerIds.map((playerId) => ({
    playerId,
    before: hallOfFameScoreAt(before, playerId),
    after: hallOfFameScoreAt(after, playerId),
  }));
}

/**
 * The score gained between the two states. A side where the player has no
 * score counts as `absentAs` - a season score and a Hall of Fame score both
 * start at 0. Without it the change is unknown.
 */
export function scoreChange(
  before: number | undefined,
  after: number | undefined,
  absentAs?: number,
): number | undefined {
  const from = before ?? absentAs;
  const to = after ?? absentAs;
  if (from === undefined || to === undefined) return undefined;
  return to - from;
}

/**
 * The places gained between the two states. A positive number is a move up
 * the leaderboard. A player who has no place on one of the two sides has no
 * change of place.
 */
export function rankChange(before: number | undefined, after: number | undefined): number | undefined {
  if (before === undefined || after === undefined) return undefined;
  return before - after;
}
