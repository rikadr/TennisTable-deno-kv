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
 * Two guards support the rule:
 *  - A group of games smaller than MIN_GAMES_FOR_SHARES gets no shares at all.
 *    The caller shows "not enough games" instead.
 *  - A rating gap group below MIN_GAMES_PER_BUCKET is not plotted, so one game
 *    cannot draw a 0% or a 100%.
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
import { gameTimingStats, serveStats } from "../game/game-tracking-stats";

/** A group of games smaller than this gets no shares. */
export const MIN_GAMES_FOR_SHARES = 10;
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
  if (games.length < MIN_GAMES_FOR_SHARES) return undefined;

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
// Games: how much detail we record, and what the scores look like
// ---------------------------------------------------------------------------

export type DetailLevels = {
  /** Share of games that record how many sets each player won. */
  withSets: number;
  /** Share of games that record the points of each set. */
  withPoints: number;
  /** Share of games that record every point as it was scored. */
  tracked: number;
  /** Of the tracked games, the share logged on the wall mounted live screen. */
  trackedOnLiveScreen: number;
};

/**
 * The three levels of detail a game can record. They nest strictly: points
 * require sets, and a point by point log requires points. See
 * `validateScoreGame` in the games projector.
 */
export function detailLevels(games: Game[]): DetailLevels | undefined {
  if (games.length < MIN_GAMES_FOR_SHARES) return undefined;

  const withSets = games.filter((game) => game.score !== undefined);
  const withPoints = withSets.filter((game) => game.score?.setPoints !== undefined);
  const tracked = withPoints.filter(isTrackedGame);
  const onLiveScreen = tracked.filter((game) => game.score?.tracking?.source === "live-game");

  return {
    withSets: percent(withSets.length, games.length),
    withPoints: percent(withPoints.length, games.length),
    tracked: percent(tracked.length, games.length),
    trackedOnLiveScreen: percent(onLiveScreen.length, tracked.length),
  };
}

/** The tracked share per month, so the trend of how much we record is visible. */
export function trackedShareTrend(games: Game[]): TrendPoint[] {
  const buckets = new Map<string, { timestamp: number; total: number; tracked: number }>();
  for (const game of games) {
    const date = new Date(game.playedAt);
    const key = getPeriodKey(date, "month");
    const bucket = buckets.get(key) ?? { timestamp: getPeriodTimestamp(date, "month"), total: 0, tracked: 0 };
    bucket.total++;
    if (isTrackedGame(game)) bucket.tracked++;
    buckets.set(key, bucket);
  }
  // A month below the minimum is left out. Reporting it as 0% would claim that
  // none of its games were tracked, which is not what too few games means.
  return Array.from(buckets)
    .filter(([, bucket]) => bucket.total >= MIN_GAMES_FOR_SHARES)
    .map(([period, bucket]) => ({
      period,
      timestamp: bucket.timestamp,
      share: percent(bucket.tracked, bucket.total),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export type ScoreShape = {
  /** Share of games with sets where the loser won no set at all. */
  whitewash: number;
  /** Share of sets that reach deuce, so both players got to 10 or more. */
  setsToDeuce?: number;
  medianPointsPerSet?: number;
  medianSetMargin?: number;
};

export function scoreShape(games: Game[]): ScoreShape | undefined {
  const withSets = games.filter((game) => game.score !== undefined);
  if (withSets.length < MIN_GAMES_FOR_SHARES) return undefined;

  const whitewashes = withSets.filter((game) => game.score!.setsWon.gameLoser === 0);

  const sets = withSets.flatMap((game) => game.score?.setPoints ?? []);
  const enoughSets = sets.length >= MIN_GAMES_FOR_SHARES;
  const deuceSets = sets.filter((set) => set.gameWinner >= 10 && set.gameLoser >= 10);

  return {
    whitewash: percent(whitewashes.length, withSets.length),
    setsToDeuce: enoughSets ? percent(deuceSets.length, sets.length) : undefined,
    medianPointsPerSet: enoughSets ? median(sets.map((set) => set.gameWinner + set.gameLoser)) : undefined,
    medianSetMargin: enoughSets ? median(sets.map((set) => Math.abs(set.gameWinner - set.gameLoser))) : undefined,
  };
}

export type PaceAndServe = {
  medianGameDurationMs: number;
  medianPointGapMs: number;
  /** Share of points won by the player who served them. */
  pointsWonOnServe: number;
  medianPointsPerGame: number;
};

/** Only tracked games carry timings and serves, so this covers that subset. */
export function paceAndServe(games: Game[]): PaceAndServe | undefined {
  const tracked = games.filter(isTrackedGame);
  if (tracked.length < MIN_GAMES_FOR_SHARES) return undefined;

  const durations: number[] = [];
  const gaps: number[] = [];
  const pointsPerGame: number[] = [];
  let served = 0;
  let wonOnServe = 0;

  for (const game of tracked) {
    const score = game.score;
    if (!score?.tracking || !score.pointSequences) continue;
    const timing = gameTimingStats(score.tracking);
    durations.push(timing.durationMs);
    gaps.push(timing.averagePointGapMs);
    pointsPerGame.push(score.pointSequences.reduce((total, set) => total + set.length, 0));

    const serves = serveStats(score.pointSequences, score.tracking.firstServers);
    served += serves.winner.served + serves.loser.served;
    wonOnServe += serves.winner.won + serves.loser.won;
  }

  return {
    medianGameDurationMs: median(durations) ?? 0,
    medianPointGapMs: median(gaps) ?? 0,
    pointsWonOnServe: percent(wonOnServe, served),
    medianPointsPerGame: median(pointsPerGame) ?? 0,
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
  let counted = 0;
  forEachGameWithPreGameStanding(games, players, (game, { elo }) => {
    counted++;
    if (view === "all" || view === "wins") gaps.push(elo.loser - elo.winner);
    if (view === "all" || view === "losses") gaps.push(elo.winner - elo.loser);
  });
  // The minimum counts games, not entries. The "all" view takes two entries per
  // game, so counting entries would let it through on half as many games.
  if (counted < MIN_GAMES_FOR_SHARES) return undefined;

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

  if (total < MIN_GAMES_FOR_SHARES) return undefined;

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
  if (games.length < MIN_GAMES_FOR_SHARES) return undefined;

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
