/**
 * Every league-wide statistic the public Statistics page shows.
 *
 * THE PRIVACY RULE OF THIS FILE
 *
 * Overall statistics used to live on the admin page only. The reason was
 * social: a player who sees hard game counts on public display may stop
 * registering games, because a manager could read the app and conclude they
 * play too much. The risk is about quantity, not about the shape of the data.
 *
 * So every function here returns shares, medians, averages and percentages.
 * None of them returns a count of games or of players. Counts become ratios
 * inside this file, so a count never reaches a component prop, a chart dataset
 * or the DOM, and it cannot be read back out of the React devtools.
 *
 * THE ONE EXCEPTION IS `leaguePace`. It gives the games of the whole league per
 * day, per week and per month. The risk the rule protects against is a manager
 * who reads the games of one player, and a rate over the whole league does not
 * name a player or let anyone work back to one. So league volume is allowed,
 * and the games of one player are still never returned.
 *
 * A function needs one game only. It gives the shares of the games it has, and
 * an empty group gets no shares at all. The caller shows "not enough games"
 * instead. A small group can read 0% or 100%, which is the true share of the
 * games it holds.
 *
 * One guard is left. A rating gap group below MIN_GAMES_PER_BUCKET is not
 * plotted, because that chart reads each group against the rating model and one
 * game per group makes the comparison noise.
 *
 * The functions here return an exact percentage. `fmtNum` decides how to print
 * it, the same way it does everywhere else in the app: a value of 1 or more
 * prints as a whole number, and a smaller value keeps 1 or 2 decimals so a
 * quiet group reads as 0,4% and not as 0%.
 *
 * Add a statistic here, not in a component, and keep the return type free of
 * counts.
 */

import { Elo } from "../../client/client-db/elo";
import { isTrackedGame } from "../../client/client-db/achievements";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { Player } from "../../client/client-db/event-store/projectors/players-projector";
import { EventType, EventTypeEnum } from "../../client/client-db/event-store/event-types";
import { advancePeriod, getPeriodKey, getPeriodStart, getPeriodTimestamp, Period } from "../../common/period-utils";
import { gameTimingStats, longestStreaks, serveStats } from "../game/game-tracking-stats";

/** A rating gap bucket with fewer games than this is not plotted. */
export const MIN_GAMES_PER_BUCKET = 20;
/** Rating gaps are grouped in steps of this many points. */
export const GAP_GROUP_SIZE = 50;
/** Times of the day are grouped in slots of this many minutes. */
export const TIME_SLOT_MINUTES = 15;

const SLOTS_PER_DAY = (24 * 60) / TIME_SLOT_MINUTES;

// ---------------------------------------------------------------------------
// Shared maths. None of these leak a count to a caller.
// ---------------------------------------------------------------------------

export function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** An exact percent. `fmtNum` decides how many decimals to print. */
export function percent(part: number, whole: number): number {
  if (whole === 0) return 0;
  return (part / whole) * 100;
}

/**
 * Divides every count by the largest one, so the busiest entry reads 100.
 *
 * Use this for a chart with many groups, such as the 15 minute slots of the day
 * or the rating gap groups. A share of the total makes every group only a few
 * percent of the whole, which is hard to read. Against the peak, every group
 * keeps the full range of 0 to 100 and the shape of the chart stays true.
 */
function indexOfPeak(counts: number[]): number[] {
  const peak = Math.max(...counts, 0);
  if (peak === 0) return counts.map(() => 0);
  return counts.map((count) => (count / peak) * 100);
}

/** Where both players stood before the game was played. */
export type PreGameStanding = {
  elo: { winner: number; loser: number };
  /**
   * How many games each player had played before this one. It decides who the
   * weaker player is when the two ratings are exactly equal.
   */
  played: { winner: number; loser: number };
};

/**
 * Walks every game once and reports where both players stood BEFORE it.
 *
 * `Elo.eloCalculator` invokes its callback after it has already applied the
 * result, so the map holds the ratings after the game. Elo here is zero-sum:
 * the winner gains exactly what the loser loses, and that swing is the third
 * callback argument. So the ratings before the game follow by arithmetic, and
 * the games played before it are one fewer than the map holds.
 */
export function forEachGameWithPreGameStanding(
  games: Game[],
  players: Player[],
  onGame: (game: Game, standing: PreGameStanding) => void,
): void {
  Elo.eloCalculator(games, players, (map, game, pointsWon) => {
    const winner = map.get(game.winner)!;
    const loser = map.get(game.loser)!;
    onGame(game, {
      elo: { winner: winner.elo - pointsWon, loser: loser.elo + pointsWon },
      played: { winner: winner.totalGames - 1, loser: loser.totalGames - 1 },
    });
  });
}

/**
 * Which of the two players was the weaker one before the game.
 *
 * The rating decides it. Two players can hold exactly the same rating, which
 * happens when they both play their first game, and then the experience each of
 * them brings decides it: the player who has played fewer games is the weaker
 * one. When the two are equal on the rating and on the experience there is no
 * weaker player, and the caller leaves the game out.
 */
export function weakerPlayer({ elo, played }: PreGameStanding): "winner" | "loser" | undefined {
  if (elo.winner !== elo.loser) return elo.winner < elo.loser ? "winner" : "loser";
  if (played.winner !== played.loser) return played.winner < played.loser ? "winner" : "loser";
  return undefined;
}

// ---------------------------------------------------------------------------
// Activity: when the league plays
// ---------------------------------------------------------------------------

export type TrendPoint = {
  /** Bucket key, unique and sortable. */
  period: string;
  timestamp: number;
  /** 0-100, where the busiest period of the whole history reads 100. */
  share: number;
};

/**
 * Games per month or per week, indexed so the busiest period reads 100. Empty
 * periods between the first and the last game are filled in with 0, so a quiet
 * stretch shows as a dip and not as a missing point.
 */
export function activityTrend(games: Game[], period: Period): TrendPoint[] {
  if (games.length === 0) return [];

  const counts = new Map<string, { timestamp: number; count: number }>();
  for (const game of games) {
    const date = new Date(game.playedAt);
    const key = getPeriodKey(date, period);
    const bucket = counts.get(key);
    if (bucket) bucket.count++;
    else counts.set(key, { timestamp: getPeriodTimestamp(date, period), count: 1 });
  }

  const timestamps = Array.from(counts.values(), (bucket) => bucket.timestamp);
  const first = new Date(Math.min(...timestamps));
  const last = Math.max(...timestamps);

  const ordered: { period: string; timestamp: number; count: number }[] = [];
  for (let cursor = first; cursor.getTime() <= last; cursor = nextPeriod(cursor, period)) {
    const key = getPeriodKey(cursor, period);
    ordered.push({
      period: key,
      timestamp: getPeriodTimestamp(cursor, period),
      count: counts.get(key)?.count ?? 0,
    });
  }

  const shares = indexOfPeak(ordered.map((entry) => entry.count));
  return ordered.map((entry, index) => ({
    period: entry.period,
    timestamp: entry.timestamp,
    share: shares[index],
  }));
}

/**
 * The start of the period after the one the date is in. `advancePeriod` in
 * period-utils steps from the date itself, which skips a month when the date is
 * the 31st, so the trend steps from the period start instead.
 */
function nextPeriod(date: Date, period: Period): Date {
  const start = new Date(getPeriodTimestamp(date, period));
  switch (period) {
    case "day":
      start.setDate(start.getDate() + 1);
      return start;
    case "week":
      start.setDate(start.getDate() + 7);
      return start;
    case "month":
      start.setMonth(start.getMonth() + 1);
      return start;
    case "year":
      start.setFullYear(start.getFullYear() + 1);
      return start;
  }
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type WeekdayShare = { weekday: string; short: string; share: number };

/** Share of all games played on each weekday. The shares add up to 100. */
export function weekdayShares(games: Game[]): WeekdayShare[] {
  const counts = new Array<number>(7).fill(0);
  for (const game of games) {
    const day = new Date(game.playedAt).getDay();
    counts[day === 0 ? 6 : day - 1]++;
  }
  return WEEKDAY_NAMES.map((weekday, index) => ({
    weekday,
    short: weekday.slice(0, 3),
    share: percent(counts[index], games.length),
  }));
}

export type TimeSlotShare = {
  slot: string;
  slotIndex: number;
  /** 0-100, where the busiest slot of the day reads 100. */
  share: number;
};

/**
 * How busy each 15 minute slot of the day is, against the busiest slot, from
 * the earliest slot the league has ever played in to the latest.
 */
export function timeOfDayShares(games: Game[]): TimeSlotShare[] {
  if (games.length === 0) return [];

  const counts = new Array<number>(SLOTS_PER_DAY).fill(0);
  let earliest = SLOTS_PER_DAY;
  let latest = -1;
  for (const game of games) {
    const date = new Date(game.playedAt);
    const slotIndex = Math.floor((date.getHours() * 60 + date.getMinutes()) / TIME_SLOT_MINUTES);
    counts[slotIndex]++;
    earliest = Math.min(earliest, slotIndex);
    latest = Math.max(latest, slotIndex);
  }

  const inRange = counts.slice(earliest, latest + 1);
  const shares = indexOfPeak(inRange);
  return inRange.map((_, offset) => ({
    slot: slotLabel(earliest + offset),
    slotIndex: earliest + offset,
    share: shares[offset],
  }));
}

export function slotLabel(slotIndex: number): string {
  const totalMinutes = slotIndex * TIME_SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export type ActivityHighlights = {
  busiestWeekday: WeekdayShare;
  busiestSlot: TimeSlotShare;
  /** Minutes past midnight of the median game. */
  medianMinuteOfDay: number;
  /** Share of all games played from Monday to Friday. */
  weekdayShare: number;
};

export function activityHighlights(games: Game[]): ActivityHighlights | undefined {
  if (games.length === 0) return undefined;

  const weekdays = weekdayShares(games);
  const slots = timeOfDayShares(games);
  const minutes = games.map((game) => {
    const date = new Date(game.playedAt);
    return date.getHours() * 60 + date.getMinutes();
  });
  const workdayGames = games.filter((game) => {
    const day = new Date(game.playedAt).getDay();
    return day >= 1 && day <= 5;
  });

  return {
    busiestWeekday: weekdays.reduce((best, day) => (day.share > best.share ? day : best)),
    busiestSlot: slots.reduce((best, slot) => (slot.share > best.share ? slot : best)),
    medianMinuteOfDay: Math.round(median(minutes) ?? 0),
    weekdayShare: percent(workdayGames.length, games.length),
  };
}

export function minuteOfDayLabel(minuteOfDay: number): string {
  const hours = Math.floor(minuteOfDay / 60) % 24;
  const minutes = Math.round(minuteOfDay) % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Games: how much detail every game records
// ---------------------------------------------------------------------------
//
// A game always records a winner and a loser. It can also record the sets, the
// points of each set, and the point by point log with its times. The levels
// nest strictly, and the Games tab shows one section per level. See
// `validateScoreGame` in the games projector.
//
// EVERY SHARE IS OVER THE GAMES OF ITS OWN LEVEL. A point level percentage is a
// share of the games that record points, and never of all the games: we do not
// know what a game without points would have contributed, so it cannot sit in
// the denominator. Each function below filters to its own level first.

export type DetailLevels = {
  /** Share of games that record how many sets each player won. */
  withSets: number;
  /** Share of games that record the points of each set. */
  withPoints: number;
  /** Share of games that record every point as it was scored. */
  tracked: number;
};

/** How much of the period reaches each level. The section headers print these. */
export function detailLevels(games: Game[]): DetailLevels | undefined {
  if (games.length === 0) return undefined;

  const withSets = games.filter((game) => game.score !== undefined);
  const withPoints = withSets.filter((game) => game.score?.setPoints !== undefined);
  const tracked = withPoints.filter(isTrackedGame);

  return {
    withSets: percent(withSets.length, games.length),
    withPoints: percent(withPoints.length, games.length),
    tracked: percent(tracked.length, games.length),
  };
}

export type DetailLevelPoint = {
  period: string;
  timestamp: number;
  /** The four shares of the month. They add up to 100. */
  noScore: number;
  sets: number;
  points: number;
  tracked: number;
};

/**
 * The four levels of detail per month, as shares of the games of that month.
 * The bands stack to 100, so the chart shows how the recording has moved from
 * a bare result towards a full point by point log.
 */
export function detailLevelTrend(games: Game[]): DetailLevelPoint[] {
  const buckets = new Map<
    string,
    { timestamp: number; played: number; noScore: number; sets: number; points: number; tracked: number }
  >();

  for (const game of games) {
    const date = new Date(game.playedAt);
    const key = getPeriodKey(date, "month");
    const bucket = buckets.get(key) ?? {
      timestamp: getPeriodTimestamp(date, "month"),
      played: 0,
      noScore: 0,
      sets: 0,
      points: 0,
      tracked: 0,
    };
    bucket.played++;
    if (game.score === undefined) bucket.noScore++;
    else if (game.score.setPoints === undefined) bucket.sets++;
    else if (isTrackedGame(game)) bucket.tracked++;
    else bucket.points++;
    buckets.set(key, bucket);
  }

  return Array.from(buckets)
    .map(([period, bucket]) => ({
      period,
      timestamp: bucket.timestamp,
      noScore: percent(bucket.noScore, bucket.played),
      sets: percent(bucket.sets, bucket.played),
      points: percent(bucket.points, bucket.played),
      tracked: percent(bucket.tracked, bucket.played),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

// ---------------------------------------------------------------------------
// Level 1: the game level. Winner, loser and time, so every game.
// ---------------------------------------------------------------------------

export type GameLevelStats = {
  /** Median rating gap between the two players, before the game. */
  medianRatingGap: number;
  /** Median days since the same pair last played, over the games that repeat a pair. */
  medianDaysSinceThePairPlayed?: number;
  /** Share of the games that are the first ever meeting of the pair. */
  firstMeeting: number;
  /** The three shares add up to 100. Ranked is measured at the time of the game. */
  rankedMix: { bothRanked: number; oneRanked: number; neitherRanked: number };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * What the winner and the loser alone tell us.
 *
 * The whole history walks, because the rating of a game, the previous meeting
 * of a pair and the experience of a player all come from the games before it.
 * Only the games from `cutoff` on are aggregated.
 */
export function gameLevelStats(
  games: Game[],
  players: Player[],
  gameLimitForRanked: number,
  cutoff: number,
): GameLevelStats | undefined {
  const gaps: number[] = [];
  const daysSince: number[] = [];
  const lastMeeting = new Map<string, number>();
  let played = 0;
  let firstMeetings = 0;
  let bothRanked = 0;
  let oneRanked = 0;
  let neitherRanked = 0;

  forEachGameWithPreGameStanding(games, players, (game, standing) => {
    const key = pairKey(game.winner, game.loser);
    const met = lastMeeting.get(key);
    lastMeeting.set(key, game.playedAt);
    if (game.playedAt < cutoff) return;

    played++;
    gaps.push(Math.abs(standing.elo.winner - standing.elo.loser));
    if (met === undefined) firstMeetings++;
    else daysSince.push((game.playedAt - met) / DAY_MS);

    const ranked =
      (standing.played.winner >= gameLimitForRanked ? 1 : 0) +
      (standing.played.loser >= gameLimitForRanked ? 1 : 0);
    if (ranked === 2) bothRanked++;
    else if (ranked === 1) oneRanked++;
    else neitherRanked++;
  });

  if (played === 0) return undefined;

  return {
    medianRatingGap: median(gaps) ?? 0,
    medianDaysSinceThePairPlayed: median(daysSince),
    firstMeeting: percent(firstMeetings, played),
    rankedMix: {
      bothRanked: percent(bothRanked, played),
      oneRanked: percent(oneRanked, played),
      neitherRanked: percent(neitherRanked, played),
    },
  };
}

/** The length of an average month, so a rate per month is not off by a day. */
const DAYS_IN_A_MONTH = 365.25 / 12;

export type LeaguePace = {
  /** Games the league plays on an average day of the period. */
  perDay: number;
  perWeek: number;
  perMonth: number;
};

/**
 * How much the league plays, as a rate over the period.
 *
 * The period runs from `from` to `to`, and a period that starts before the
 * first game starts at that game instead, so the years before the league
 * existed do not drag the rate down. A period shorter than a day counts as one
 * day, so the day that has just started does not read as a huge rate.
 *
 * This is the one function of this file that carries the volume of the league.
 * See the header: a rate over the whole league names nobody.
 */
export function leaguePace(games: Game[], from: number, to: number): LeaguePace | undefined {
  if (games.length === 0) return undefined;

  const firstGame = Math.min(...games.map((game) => game.playedAt));
  const start = Math.max(from, firstGame);
  const days = Math.max(1, (to - start) / DAY_MS);
  const perDay = games.length / days;

  return { perDay, perWeek: perDay * 7, perMonth: perDay * DAYS_IN_A_MONTH };
}

// ---------------------------------------------------------------------------
// Level 2: the set level. Games that record how many sets each player won.
// ---------------------------------------------------------------------------

export type SetLevelStats = {
  /** Share of all the sets of these games that the game winners won. */
  setsWonByTheWinner: number;
  /** Share of the games per number of sets they hold. */
  bySetsPlayed: { setsPlayed: number; share: number }[];
  /** Share of the games per set score, read from the winner: 2-0, 2-1, 3-1… */
  byScore: { score: string; setsPlayed: number; share: number }[];
};

export function setLevelStats(games: Game[]): SetLevelStats | undefined {
  const withSets = games.filter((game) => game.score !== undefined);
  if (withSets.length === 0) return undefined;

  const setsWon = withSets.map((game) => game.score!.setsWon);
  const wonByTheWinner = setsWon.reduce((sum, sets) => sum + sets.gameWinner, 0);
  const allSets = setsWon.reduce((sum, sets) => sum + sets.gameWinner + sets.gameLoser, 0);

  const perLength = new Map<number, number>();
  const perScore = new Map<string, { setsPlayed: number; played: number }>();
  for (const sets of setsWon) {
    const length = sets.gameWinner + sets.gameLoser;
    perLength.set(length, (perLength.get(length) ?? 0) + 1);
    // The score always reads from the winner, so 2-1 and 1-2 are one entry.
    const score = `${sets.gameWinner}-${sets.gameLoser}`;
    const entry = perScore.get(score) ?? { setsPlayed: length, played: 0 };
    entry.played++;
    perScore.set(score, entry);
  }

  return {
    setsWonByTheWinner: percent(wonByTheWinner, allSets),
    bySetsPlayed: Array.from(perLength)
      .map(([setsPlayed, played]) => ({ setsPlayed, share: percent(played, withSets.length) }))
      .sort((a, b) => a.setsPlayed - b.setsPlayed),
    byScore: Array.from(perScore)
      .map(([score, entry]) => ({
        score,
        setsPlayed: entry.setsPlayed,
        share: percent(entry.played, withSets.length),
      }))
      .sort((a, b) => a.setsPlayed - b.setsPlayed || a.score.localeCompare(b.score)),
  };
}

// ---------------------------------------------------------------------------
// Level 3: the point level. Games that record the points of each set.
// ---------------------------------------------------------------------------

/** Both players at this many points or more is a deuce, at every level. */
export const DEUCE_POINTS = 10;

export type PointLevelStats = {
  /** Share of the sets that reach deuce. */
  setsToDeuce: number;
  medianPointsPerSet: number;
  medianSetMargin: number;
  /** Share of all the points of these games that the game winner won. */
  pointsWonByTheWinner: number;
  /** Share of the games the winner won with fewer points than the loser. */
  lessIsMore: number;
  /** Share of the games won by the player who won the first set. */
  firstSetWinnerWins: number;
  /**
   * How much more often a match deciding set reaches deuce than every other
   * set. 1.4 means 1.4 times as often, and the two pools never overlap.
   *
   * A match deciding set is the last set of a game where the loser stopped one
   * set short, so both players could still win the match when the set started.
   * The last set of a game that ended 2-0 also won the match, but only for the
   * player who was already ahead, so it belongs to the other pool.
   */
  deuceRatioOfDecidingSets?: number;
  medianPointsPerGame: number;
  /** The median total of points per number of sets played, for the 2 set
   * counts with the most games, in rising order of sets. */
  medianPointsPerGameBySets: { setsPlayed: number; median: number }[];
  /** Share of the games per total points played. One entry per total. */
  pointsPerGame: { points: number; share: number }[];
  /** Share of the sets per score of the set loser, and a deuce group. */
  losingSetScores: { label: string; share: number }[];
};

/** A game is match deciding in its last set when the loser stopped one set short. */
function hasDecidingSet(score: { setsWon: { gameWinner: number; gameLoser: number } }): boolean {
  return score.setsWon.gameLoser === score.setsWon.gameWinner - 1;
}

export function pointLevelStats(games: Game[]): PointLevelStats | undefined {
  const withPoints = games.filter((game) => (game.score?.setPoints?.length ?? 0) > 0);
  if (withPoints.length === 0) return undefined;

  const sets = withPoints.flatMap((game) => game.score!.setPoints!);
  const deuceSets = sets.filter((set) => set.gameWinner >= DEUCE_POINTS && set.gameLoser >= DEUCE_POINTS);

  const totals = withPoints.map((game) =>
    game.score!.setPoints!.reduce(
      (total, set) => ({ winner: total.winner + set.gameWinner, loser: total.loser + set.gameLoser }),
      { winner: 0, loser: 0 },
    ),
  );
  const wonByTheWinner = totals.reduce((sum, points) => sum + points.winner, 0);
  const allPoints = totals.reduce((sum, points) => sum + points.winner + points.loser, 0);
  const fewerPoints = totals.filter((points) => points.winner < points.loser);
  const firstSetToTheWinner = withPoints.filter((game) => {
    const first = game.score!.setPoints![0];
    return first.gameWinner > first.gameLoser;
  });

  // The last set of a game the loser lost by one set decided the match. Every
  // other set of every game is the pool it is measured against.
  let decidingSets = 0;
  let decidingDeuce = 0;
  let otherSets = 0;
  let otherDeuce = 0;
  for (const game of withPoints) {
    const setPoints = game.score!.setPoints!;
    const decidingIndex = hasDecidingSet(game.score!) ? setPoints.length - 1 : -1;
    for (let index = 0; index < setPoints.length; index++) {
      const set = setPoints[index];
      const isDeuce = set.gameWinner >= DEUCE_POINTS && set.gameLoser >= DEUCE_POINTS;
      if (index === decidingIndex) {
        decidingSets++;
        if (isDeuce) decidingDeuce++;
      } else {
        otherSets++;
        if (isDeuce) otherDeuce++;
      }
    }
  }
  const otherDeuceShare = percent(otherDeuce, otherSets);
  const deuceRatioOfDecidingSets =
    decidingSets === 0 || otherSets === 0 || otherDeuceShare === 0
      ? undefined
      : percent(decidingDeuce, decidingSets) / otherDeuceShare;

  const perTotal = new Map<number, number>();
  for (const points of totals) {
    const total = points.winner + points.loser;
    perTotal.set(total, (perTotal.get(total) ?? 0) + 1);
  }

  const totalsBySets = new Map<number, number[]>();
  withPoints.forEach((game, index) => {
    const setsPlayed = game.score!.setPoints!.length;
    const gameTotals = totalsBySets.get(setsPlayed) ?? [];
    gameTotals.push(totals[index].winner + totals[index].loser);
    totalsBySets.set(setsPlayed, gameTotals);
  });

  const perLosingScore = new Map<string, number>();
  for (const set of sets) {
    const losing = Math.min(set.gameWinner, set.gameLoser);
    const label = losing >= DEUCE_POINTS ? "deuce" : String(losing);
    perLosingScore.set(label, (perLosingScore.get(label) ?? 0) + 1);
  }
  const losingScoreLabels = [...Array.from({ length: DEUCE_POINTS }, (_, score) => String(score)), "deuce"];

  return {
    setsToDeuce: percent(deuceSets.length, sets.length),
    medianPointsPerSet: median(sets.map((set) => set.gameWinner + set.gameLoser)) ?? 0,
    medianSetMargin: median(sets.map((set) => Math.abs(set.gameWinner - set.gameLoser))) ?? 0,
    pointsWonByTheWinner: percent(wonByTheWinner, allPoints),
    lessIsMore: percent(fewerPoints.length, withPoints.length),
    firstSetWinnerWins: percent(firstSetToTheWinner.length, withPoints.length),
    deuceRatioOfDecidingSets,
    medianPointsPerGame: median(totals.map((points) => points.winner + points.loser)) ?? 0,
    medianPointsPerGameBySets: Array.from(totalsBySets)
      .sort(([setsA, totalsA], [setsB, totalsB]) => totalsB.length - totalsA.length || setsA - setsB)
      .slice(0, 2)
      .map(([setsPlayed, gameTotals]) => ({ setsPlayed, median: median(gameTotals) ?? 0 }))
      .sort((a, b) => a.setsPlayed - b.setsPlayed),
    pointsPerGame: Array.from(perTotal)
      .map(([points, played]) => ({ points, share: percent(played, withPoints.length) }))
      .sort((a, b) => a.points - b.points),
    losingSetScores: losingScoreLabels.map((label) => ({
      label,
      share: percent(perLosingScore.get(label) ?? 0, sets.length),
    })),
  };
}

// ---------------------------------------------------------------------------
// Level 4: the tracked games. Every point in order, with its time and server.
// ---------------------------------------------------------------------------

/** A set is won at 11 points and 2 clear, the rule the live game tracker uses. */
export const POINTS_TO_WIN_SET = 11;
const CLEAR_POINTS_TO_WIN_SET = 2;

/** True when the score means the set is over under the 11 and 2 rule. */
function setIsWon(winner: number, loser: number): boolean {
  return Math.max(winner, loser) >= POINTS_TO_WIN_SET && Math.abs(winner - loser) >= CLEAR_POINTS_TO_WIN_SET;
}

type SetWalk = {
  /**
   * Set points each side held. A player is at set point at 10 or more with a
   * lead of 1 or more, so the two sides never hold one at the same time.
   */
  setPoints: { winner: number; loser: number };
  /** "W" when the game winner won the set. */
  setWinner: "W" | "L";
  /** False when the set was marked won at a score the rule does not accept. */
  won: boolean;
  /** Index of the point that ended the set, or the length of the sequence. */
  endedAt: number;
};

/**
 * Replays one set point by point and reports the set points each side held.
 *
 * A set is marked won by hand, so a sequence can hold points after the set was
 * already won under the rule. The replay stops at the point that won it.
 */
function walkSet(sequence: string): SetWalk {
  let winner = 0;
  let loser = 0;
  const setPoints = { winner: 0, loser: 0 };
  let endedAt = sequence.length;

  for (let index = 0; index < sequence.length; index++) {
    if (winner >= DEUCE_POINTS && winner - loser >= 1) setPoints.winner++;
    else if (loser >= DEUCE_POINTS && loser - winner >= 1) setPoints.loser++;

    if (sequence[index] === "W") winner++;
    else loser++;

    if (setIsWon(winner, loser)) {
      endedAt = index + 1;
      break;
    }
  }

  return {
    setPoints,
    setWinner: winner > loser ? "W" : "L",
    won: setIsWon(winner, loser),
    endedAt,
  };
}

export type TrackedLevelStats = {
  medianGameDurationMs: number;
  medianPointGapMs: number;
  /** Points the server wins for every point the server loses. */
  serveRatio?: number;
  /** Share of the sets won by the player who scored the first point of the set. */
  firstPointWinsTheSet: number;
  /** Median longest run of points in a row inside a game. */
  medianLongestRun: number;
  /** How much longer a point at deuce takes than a point outside deuce. */
  deucePaceRatio?: number;
  /** Points undone while tracking, per tracked game. */
  averageCorrections: number;
  /** Set points the set winner held, on average, including the one that won it. */
  setPointsToClose?: number;
  /** Match points the game winner held, on average, including the one that won it. */
  matchPointsToClose?: number;
  /** Share of the set points that were converted. */
  setPointConversion?: number;
  /** Share of the match points that were converted. */
  matchPointConversion?: number;
  /** Share of the games where the game loser held a match point. */
  matchPointForTheLoser?: number;
  /** Share of the sets where the set loser held a set point. */
  setPointForTheSetLoser?: number;
};

/**
 * What the point by point log tells us.
 *
 * The set point and match point statistics leave out a set that was marked won
 * at a score the 11 and 2 rule does not accept, because such a set holds no set
 * point. The card says so.
 */
export function trackedLevelStats(games: Game[]): TrackedLevelStats | undefined {
  const tracked = games.filter(isTrackedGame);
  if (tracked.length === 0) return undefined;

  const durations: number[] = [];
  const gaps: number[] = [];
  const longestRuns: number[] = [];
  const corrections: number[] = [];
  const deuceSeconds: number[] = [];
  const otherSeconds: number[] = [];
  let served = 0;
  let wonOnServe = 0;
  let setsPlayed = 0;
  let setsWonFromTheFirstPoint = 0;

  let setsClosed = 0;
  let setPointsHeld = 0;
  let setPointsOfTheSetWinner = 0;
  let setsLoserHeldSetPoint = 0;
  let gamesClosed = 0;
  let matchPointsHeld = 0;
  let matchPointsOfTheGameWinner = 0;
  let gamesLoserHeldMatchPoint = 0;

  for (const game of tracked) {
    const score = game.score;
    if (!score?.pointSequences) continue;

    if (score.tracking) {
      const timing = gameTimingStats(score.tracking);
      durations.push(timing.durationMs);
      gaps.push(timing.averagePointGapMs);
      corrections.push(score.tracking.corrections);

      const serves = serveStats(score.pointSequences, score.tracking);
      served += serves.winner.served + serves.loser.served;
      wonOnServe += serves.winner.won + serves.loser.won;
    }

    const streaks = longestStreaks(score.pointSequences);
    longestRuns.push(Math.max(streaks.winner, streaks.loser));

    // The match is a first to N, and N is the sets the winner ended on.
    const setsToWin = score.setsWon.gameWinner;
    let setsForTheWinner = 0;
    let setsForTheLoser = 0;
    const matchPointsInTheGame = { winner: 0, loser: 0 };
    let gameClosed = false;

    for (let setIndex = 0; setIndex < score.pointSequences.length; setIndex++) {
      const sequence = score.pointSequences[setIndex];
      if (sequence.length === 0) continue;
      const walk = walkSet(sequence);

      setsPlayed++;
      if (sequence[0] === walk.setWinner) setsWonFromTheFirstPoint++;

      // The times of the points, split by whether the set was at deuce.
      const deltas = score.tracking?.pointDeltas[setIndex];
      if (deltas) {
        let winnerPoints = 0;
        let loserPoints = 0;
        for (let index = 0; index < walk.endedAt; index++) {
          const atDeuce = winnerPoints >= DEUCE_POINTS && loserPoints >= DEUCE_POINTS;
          // The first delta of a set is the break before it, not a point gap.
          if (index > 0) (atDeuce ? deuceSeconds : otherSeconds).push((deltas[index] ?? 0) / 10);
          if (sequence[index] === "W") winnerPoints++;
          else loserPoints++;
        }
      }

      const atMatchPoint = {
        winner: setsForTheWinner === setsToWin - 1,
        loser: setsForTheLoser === setsToWin - 1,
      };

      if (walk.won) {
        setsClosed++;
        setPointsHeld += walk.setPoints.winner + walk.setPoints.loser;
        const ofTheSetWinner = walk.setWinner === "W" ? walk.setPoints.winner : walk.setPoints.loser;
        const ofTheSetLoser = walk.setWinner === "W" ? walk.setPoints.loser : walk.setPoints.winner;
        setPointsOfTheSetWinner += ofTheSetWinner;
        if (ofTheSetLoser > 0) setsLoserHeldSetPoint++;

        if (atMatchPoint.winner) matchPointsInTheGame.winner += walk.setPoints.winner;
        if (atMatchPoint.loser) matchPointsInTheGame.loser += walk.setPoints.loser;
        // The set that a player at match point wins is the set that ends the game.
        if (walk.setWinner === "W" && atMatchPoint.winner) gameClosed = true;
      }

      if (walk.setWinner === "W") setsForTheWinner++;
      else setsForTheLoser++;
    }

    if (gameClosed) {
      gamesClosed++;
      matchPointsHeld += matchPointsInTheGame.winner + matchPointsInTheGame.loser;
      matchPointsOfTheGameWinner += matchPointsInTheGame.winner;
      if (matchPointsInTheGame.loser > 0) gamesLoserHeldMatchPoint++;
    }
  }

  const pointsLostOnServe = served - wonOnServe;
  const medianDeuceSeconds = median(deuceSeconds);
  const medianOtherSeconds = median(otherSeconds);

  return {
    medianGameDurationMs: median(durations) ?? 0,
    medianPointGapMs: median(gaps) ?? 0,
    serveRatio: pointsLostOnServe === 0 ? undefined : wonOnServe / pointsLostOnServe,
    firstPointWinsTheSet: percent(setsWonFromTheFirstPoint, setsPlayed),
    medianLongestRun: median(longestRuns) ?? 0,
    deucePaceRatio:
      medianDeuceSeconds === undefined || medianOtherSeconds === undefined || medianOtherSeconds === 0
        ? undefined
        : medianDeuceSeconds / medianOtherSeconds,
    averageCorrections: average(corrections) ?? 0,
    setPointsToClose: setsClosed === 0 ? undefined : setPointsOfTheSetWinner / setsClosed,
    matchPointsToClose: gamesClosed === 0 ? undefined : matchPointsOfTheGameWinner / gamesClosed,
    setPointConversion: setPointsHeld === 0 ? undefined : percent(setsClosed, setPointsHeld),
    matchPointConversion: matchPointsHeld === 0 ? undefined : percent(gamesClosed, matchPointsHeld),
    matchPointForTheLoser: gamesClosed === 0 ? undefined : percent(gamesLoserHeldMatchPoint, gamesClosed),
    setPointForTheSetLoser: setsClosed === 0 ? undefined : percent(setsLoserHeldSetPoint, setsClosed),
  };
}
export type TableSideStats = {
  /** Share of the games of the period with a score that record the sides. */
  sidesRecorded: number;
  /** Share of the recorded sets where the 2 sides are equally good. */
  neutralSets: number;
  /** Share of the sets with a worse side won by the player on it. */
  setsWonOnTheBadSide?: number;
  /** Share of the points of those sets won by the player on the bad side. */
  pointsWonOnTheBadSide?: number;
  /**
   * Share of the games won by the player who had the bad side in more sets
   * than their opponent. A game where both players had it equally often, which
   * every game with an even number of unequal sets is, has no such player and
   * is left out.
   */
  wonWithMoreBadSideSets?: number;
};

/**
 * What playing on the bad side of the table costs.
 *
 * Any game with a score can record which player had the bad side in each set,
 * or that the 2 sides were equally good — a tracker does it live, and the add
 * game form takes what the players remember, with or without the points of
 * each set. Every set with a worse side has exactly one player on it, so 50%
 * is the neutral reading of the set and point shares: a lower share means the
 * bad side really costs sets or points.
 *
 * A neutral set holds no bad side, so it only counts towards `neutralSets`.
 * The set and point shares need the points of the set, so a set with a side
 * but no points counts only towards the game-level share.
 */
export function tableSideStats(games: Game[]): TableSideStats | undefined {
  const withScore = games.filter((game) => game.score !== undefined);
  const withSides = withScore.filter((game) => game.score!.gameWinnerSides?.some((side) => side !== null));
  if (withSides.length === 0) return undefined;

  let recordedSets = 0;
  let neutralSets = 0;
  let unequalSets = 0;
  let setsToTheBadSide = 0;
  let unequalPoints = 0;
  let pointsToTheBadSide = 0;
  let unevenGames = 0;
  let unevenGamesToTheBadSide = 0;

  for (const game of withSides) {
    const badSideSets = { winner: 0, loser: 0 };

    const sides = game.score!.gameWinnerSides!;
    for (let setIndex = 0; setIndex < sides.length; setIndex++) {
      const side = sides[setIndex];
      if (side === null) continue;

      recordedSets++;
      if (side === "N") {
        neutralSets++;
        continue;
      }

      const gameWinnerOnTheBadSide = side === "B";
      if (gameWinnerOnTheBadSide) badSideSets.winner++;
      else badSideSets.loser++;

      // Who won the set, and its points, are only known when the game
      // records the points of each set.
      const set = game.score!.setPoints?.[setIndex];
      if (set === undefined) continue;

      unequalSets++;
      unequalPoints += set.gameWinner + set.gameLoser;
      pointsToTheBadSide += gameWinnerOnTheBadSide ? set.gameWinner : set.gameLoser;
      if ((set.gameWinner > set.gameLoser) === gameWinnerOnTheBadSide) setsToTheBadSide++;
    }

    if (badSideSets.winner !== badSideSets.loser) {
      unevenGames++;
      if (badSideSets.winner > badSideSets.loser) unevenGamesToTheBadSide++;
    }
  }

  return {
    sidesRecorded: percent(withSides.length, withScore.length),
    neutralSets: percent(neutralSets, recordedSets),
    setsWonOnTheBadSide: unequalSets === 0 ? undefined : percent(setsToTheBadSide, unequalSets),
    pointsWonOnTheBadSide: unequalPoints === 0 ? undefined : percent(pointsToTheBadSide, unequalPoints),
    wonWithMoreBadSideSets: unevenGames === 0 ? undefined : percent(unevenGamesToTheBadSide, unevenGames),
  };
}

// ---------------------------------------------------------------------------
// Matchups: who plays whom, and who wins
// ---------------------------------------------------------------------------

export type GapView = "all" | "wins" | "losses";

export type GapBucket = {
  /** The centre of the 50 point group. The group holds a gap within 25 of it. */
  gapGroup: number;
  /** 0-100, where the most common group reads 100. */
  share: number;
};

export type GapDistribution = {
  buckets: GapBucket[];
  medianGap: number;
  averageGap: number;
};

/**
 * How strong the opponents of a game are, relative to each other, over every
 * player in the league. This is the league wide version of the Opponent scores
 * card on the player page.
 *
 *  - "wins" takes the winner's view of each game: the loser's rating before the
 *    game minus the winner's. A negative value means the winner beat a stronger
 *    player.
 *  - "losses" takes the loser's view, which is the opposite sign.
 *  - "all" takes both, so the distribution is symmetric about zero.
 */
export function ratingGapDistribution(
  games: Game[],
  players: Player[],
  view: GapView,
): GapDistribution | undefined {
  const gaps: number[] = [];
  forEachGameWithPreGameStanding(games, players, (game, { elo }) => {
    if (view === "all" || view === "wins") gaps.push(elo.loser - elo.winner);
    if (view === "all" || view === "losses") gaps.push(elo.winner - elo.loser);
  });
  if (gaps.length === 0) return undefined;

  // Groups are centred on a multiple of 50, so the middle group holds the even
  // matchups from -25 to +25 and the chart is symmetric about it.
  const counts = new Map<number, number>();
  for (const gap of gaps) {
    const group = Math.round(gap / GAP_GROUP_SIZE) * GAP_GROUP_SIZE;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  // The range runs the same distance either side of zero, so the zero group
  // stays the middle entry and the groups do not move when the view changes.
  const widest = Math.max(...Array.from(counts.keys(), Math.abs));
  const centres: number[] = [];
  const ordered: number[] = [];
  for (let group = -widest; group <= widest; group += GAP_GROUP_SIZE) {
    centres.push(group);
    ordered.push(counts.get(group) ?? 0);
  }
  const shares = indexOfPeak(ordered);

  return {
    buckets: centres.map((gapGroup, index) => ({ gapGroup, share: shares[index] })),
    medianGap: median(gaps) ?? 0,
    averageGap: average(gaps) ?? 0,
  };
}

export type UpsetPoint = {
  /** The lower edge of the 50 point group of the rating gap. */
  gapGroup: number;
  /** Share of these games the lower rated player won. */
  actual: number;
  /** Share the Elo model expects the lower rated player to win. */
  expected: number;
};

export type UpsetRate = {
  points: UpsetPoint[];
  /** Share of all games won by the higher rated player. */
  favouriteWinRate: number;
};

/**
 * How often the weaker player wins, by how far apart the two ratings were,
 * against what the Elo model expects. A group holding fewer games than
 * MIN_GAMES_PER_BUCKET is left out, so one game cannot plot a 0% or a 100%.
 *
 * `weakerPlayer` decides each game, and a game with no weaker player is left
 * out.
 */
export function upsetRate(games: Game[], players: Player[]): UpsetRate | undefined {
  const groups = new Map<number, { total: number; upsets: number }>();
  let total = 0;
  let favouriteWins = 0;

  forEachGameWithPreGameStanding(games, players, (game, standing) => {
    const weaker = weakerPlayer(standing);
    if (weaker === undefined) return;

    const { elo } = standing;
    const gap = Math.abs(elo.winner - elo.loser);
    const group = Math.floor(gap / GAP_GROUP_SIZE) * GAP_GROUP_SIZE;
    const bucket = groups.get(group) ?? { total: 0, upsets: 0 };
    bucket.total++;
    total++;
    if (weaker === "winner") bucket.upsets++;
    else favouriteWins++;
    groups.set(group, bucket);
  });

  if (total === 0) return undefined;

  const points = Array.from(groups)
    .filter(([, bucket]) => bucket.total >= MIN_GAMES_PER_BUCKET)
    .sort(([a], [b]) => a - b)
    .map(([gapGroup, bucket]) => ({
      gapGroup,
      actual: percent(bucket.upsets, bucket.total),
      // The Elo expectation for the middle of the group, so the curve lines up
      // with the games the group holds rather than with its lower edge.
      expected: expectedUnderdogShare(gapGroup + GAP_GROUP_SIZE / 2) * 100,
    }));

  return { points, favouriteWinRate: percent(favouriteWins, total) };
}

/** What the Elo model expects the lower rated player of a matchup to win. */
export function expectedUnderdogShare(gap: number): number {
  return 1 / (1 + Math.pow(10, gap / Elo.DIVISOR));
}

// ---------------------------------------------------------------------------
// League: the shape of the leaderboard
// ---------------------------------------------------------------------------

export type RatingBucket = {
  /** The lower edge of the 50 point group. */
  ratingGroup: number;
  /** Share of the ranked players whose rating is in this group. */
  share: number;
};

/** How the ratings of the ranked players spread out. Ratings are already public. */
export function ratingDistribution(ratings: number[]): RatingBucket[] {
  if (ratings.length === 0) return [];

  const counts = new Map<number, number>();
  for (const rating of ratings) {
    const group = Math.floor(rating / GAP_GROUP_SIZE) * GAP_GROUP_SIZE;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }

  const groups = Array.from(counts.keys());
  const edges: number[] = [];
  const ordered: number[] = [];
  for (let group = Math.min(...groups); group <= Math.max(...groups); group += GAP_GROUP_SIZE) {
    edges.push(group);
    ordered.push(counts.get(group) ?? 0);
  }
  return edges.map((ratingGroup, index) => ({
    ratingGroup,
    share: percent(ordered[index], ratings.length),
  }));
}

export type CoveragePoint = {
  period: string;
  timestamp: number;
  /** Share of the possible pairs of active players that had met. */
  all: number;
  /** The same share among the ranked players only. */
  ranked: number;
};

export type PairingCoverage = {
  /** Where each line stands now. */
  now: { all: number; ranked: number };
  trend: CoveragePoint[];
};

/** The number of pairs a group of players can make. */
function possiblePairs(playerCount: number): number {
  return (playerCount * (playerCount - 1)) / 2;
}

const pairKey = (winner: string, loser: string): string => [winner, loser].sort().join("|");

/** The events that change which players are active. */
const ACTIVATION_EVENTS: EventTypeEnum[] = [
  EventTypeEnum.PLAYER_CREATED,
  EventTypeEnum.PLAYER_DEACTIVATED,
  EventTypeEnum.PLAYER_REACTIVATED,
];

/**
 * How much of the league has met, for every active player and for the ranked
 * players on their own. A pair counts once, whichever way round it played.
 *
 * Every month uses the players of that month. The events rebuild the group of
 * active players at the end of the month, and a player of that group counts as
 * ranked when they have enough games against the others in it. So a point
 * reads "of the pairs that existed then, this share had met". This is the same
 * measure as the admin diversity chart, by month instead of by week.
 *
 * Only the active players count. A retired player can never meet anybody new.
 */
export function pairingCoverage(
  games: Game[],
  events: EventType[],
  gameLimitForRanked: number,
): PairingCoverage | undefined {
  if (games.length === 0) return undefined;

  const activationEvents = events
    .filter((event) => ACTIVATION_EVENTS.includes(event.type))
    .sort((a, b) => a.time - b.time);

  /** Every pair that has met, whether or not both players are still active. */
  const met = new Set<string>();
  /** How many games each player has played against each opponent. */
  const gamesAgainst = new Map<string, Map<string, number>>();
  const active = new Set<string>();

  let gameIndex = 0;
  let eventIndex = 0;

  const readGamesBefore = (end: number): void => {
    while (gameIndex < games.length && games[gameIndex].playedAt < end) {
      const game = games[gameIndex++];
      met.add(pairKey(game.winner, game.loser));

      const winnerCounts = gamesAgainst.get(game.winner) ?? new Map<string, number>();
      winnerCounts.set(game.loser, (winnerCounts.get(game.loser) ?? 0) + 1);
      gamesAgainst.set(game.winner, winnerCounts);

      const loserCounts = gamesAgainst.get(game.loser) ?? new Map<string, number>();
      loserCounts.set(game.winner, (loserCounts.get(game.winner) ?? 0) + 1);
      gamesAgainst.set(game.loser, loserCounts);
    }
  };

  const readEventsBefore = (end: number): void => {
    while (eventIndex < activationEvents.length && activationEvents[eventIndex].time < end) {
      const event = activationEvents[eventIndex++];
      if (event.type === EventTypeEnum.PLAYER_DEACTIVATED) {
        active.delete(event.stream);
      } else {
        active.add(event.stream);
      }
    }
  };

  /** The share of the pairs of `group` that have met. */
  const shareMet = (group: Set<string>): number => {
    if (group.size < 2) return 0;
    let pairsMet = 0;
    for (const pair of met) {
      const [one, other] = pair.split("|");
      if (group.has(one) && group.has(other)) pairsMet++;
    }
    return percent(pairsMet, possiblePairs(group.size));
  };

  /** The active players with enough games against the other active players. */
  const rankedOf = (activePlayers: Set<string>): Set<string> => {
    const ranked = new Set<string>();
    for (const playerId of activePlayers) {
      const opponents = gamesAgainst.get(playerId);
      if (opponents === undefined) continue;
      let played = 0;
      for (const [opponentId, count] of opponents) {
        if (activePlayers.has(opponentId)) played += count;
      }
      if (played >= gameLimitForRanked) ranked.add(playerId);
    }
    return ranked;
  };

  const trend: CoveragePoint[] = [];
  const lastMonth = getPeriodTimestamp(new Date(games[games.length - 1].playedAt), "month");
  let month = getPeriodStart(new Date(games[0].playedAt), "month");

  while (month.getTime() <= lastMonth) {
    const monthEnd = advancePeriod(month, "month").getTime();
    readGamesBefore(monthEnd);
    readEventsBefore(monthEnd);

    trend.push({
      period: getPeriodKey(month, "month"),
      timestamp: month.getTime(),
      all: shareMet(active),
      ranked: shareMet(rankedOf(active)),
    });

    month = advancePeriod(month, "month");
  }

  // The trend stops at the last game, the same way the admin chart does. A
  // player who left after that game still has to leave the tiles, so the two
  // values for today read every event that is left.
  readEventsBefore(Number.POSITIVE_INFINITY);
  return { now: { all: shareMet(active), ranked: shareMet(rankedOf(active)) }, trend };
}

export type RankedMix = {
  /** Share of games where both players are ranked. */
  bothRanked: number;
  /** Share of games where one of the two players is ranked. */
  oneRanked: number;
  /** Share of games where neither player is ranked. */
  neitherRanked: number;
};

export function rankedMix(games: Game[], rankedPlayerIds: Set<string>): RankedMix | undefined {
  if (games.length === 0) return undefined;

  let both = 0;
  let one = 0;
  for (const game of games) {
    const ranked = (rankedPlayerIds.has(game.winner) ? 1 : 0) + (rankedPlayerIds.has(game.loser) ? 1 : 0);
    if (ranked === 2) both++;
    else if (ranked === 1) one++;
  }

  // Each share is worked out from the total on its own. Taking one as the
  // remainder of the other two would let a rounding error make it negative.
  return {
    bothRanked: percent(both, games.length),
    oneRanked: percent(one, games.length),
    neitherRanked: percent(games.length - both - one, games.length),
  };
}

export type RankMovement = {
  /** Share of the ranked players who hold a different place than they did. */
  moved: number;
  /** Share who climbed. */
  climbed: number;
  /** Share who fell. */
  fell: number;
};

/**
 * How much the leaderboard moved since a moment in the past.
 *
 * The rating each player held then is the last `eloAfterGame` they recorded
 * before the cutoff, which the cached leaderboard map already holds. That
 * avoids projecting a second TennisTable, and it reaches further back than
 * `leaderboardChanges`, whose window is two days.
 */
export function rankMovement(
  summaries: PlayerSummaryLike[],
  cutoff: number,
  gameLimitForRanked: number,
): RankMovement | undefined {
  const before = summaries
    .map((summary) => {
      const playedBefore = summary.games.filter((game) => game.time <= cutoff);
      return {
        id: summary.id,
        elo: playedBefore.at(-1)?.eloAfterGame ?? Elo.INITIAL_ELO,
        ranked: playedBefore.length >= gameLimitForRanked,
      };
    })
    .filter((player) => player.ranked);

  const now = summaries
    .filter((summary) => summary.games.length >= gameLimitForRanked)
    .map((summary) => ({ id: summary.id, elo: summary.elo }));

  if (before.length < 2 || now.length < 2) return undefined;

  const rankOf = (players: { id: string; elo: number }[]): Map<string, number> => {
    const sorted = [...players].sort((a, b) => b.elo - a.elo);
    return new Map(sorted.map((player, index) => [player.id, index + 1]));
  };

  const ranksBefore = rankOf(before);
  const ranksNow = rankOf(now);

  // Only players ranked at both moments can have moved. A player who became
  // ranked in between has no earlier place to compare against.
  const comparable = now.filter((player) => ranksBefore.has(player.id));
  if (comparable.length === 0) return undefined;

  let climbed = 0;
  let fell = 0;
  for (const player of comparable) {
    const from = ranksBefore.get(player.id)!;
    const to = ranksNow.get(player.id)!;
    if (to < from) climbed++;
    else if (to > from) fell++;
  }

  return {
    moved: percent(climbed + fell, comparable.length),
    climbed: percent(climbed, comparable.length),
    fell: percent(fell, comparable.length),
  };
}

/** The part of `PlayerSummary` that `rankMovement` reads. */
export type PlayerSummaryLike = {
  id: string;
  elo: number;
  games: { time: number; eloAfterGame: number }[];
};
