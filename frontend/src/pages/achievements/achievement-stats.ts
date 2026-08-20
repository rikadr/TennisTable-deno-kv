import {
  Achievement,
  ACHIEVEMENT_IS_REACHIEVABLE,
  AchievementType,
} from "../../client/client-db/achievements";
import { fmtNum } from "../../common/number-utils";
import { calendarDaysBetween } from "../../common/date-utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The value an achievement is measured in, for the achievements that carry a
 * number worth comparing. A type with no entry here shows no distribution and
 * no record history — its data holds nothing to measure.
 */
export type AchievementMetric = {
  /** Names the value, such as "Games in the day". */
  label: string;
  format: (value: number) => string;
};

const days = (value: number) => `${fmtNum(Math.round(value))} day${Math.round(value) === 1 ? "" : "s"}`;
const games = (value: number) => `${fmtNum(value)} game${value === 1 ? "" : "s"}`;
const points = (value: number) => `${fmtNum(value)} point${value === 1 ? "" : "s"}`;
const score = (value: number) => `${fmtNum(value, { digits: 1 })} Score`;
const timeOfDay = (minutesIntoDay: number) => {
  const hours = Math.floor(minutesIntoDay / 60);
  const minutes = Math.round(minutesIntoDay % 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

export const ACHIEVEMENT_METRICS: Partial<Record<AchievementType, AchievementMetric>> = {
  "hero-of-the-day": { label: "Games in the day", format: games },
  "hero-of-the-week": { label: "Games in the week", format: games },
  "hero-of-the-month": { label: "Games in the month", format: games },
  "longest-win-streak": { label: "Wins in a row", format: games },
  "longest-lose-streak": { label: "Losses in a row", format: games },
  "yin-yang": { label: "Alternating results", format: games },
  "streak-ender": { label: "Streak ended", format: games },
  "david": { label: "Score won", format: score },
  "goliath": { label: "Score lost", format: score },
  "climber": { label: "Score climbed", format: score },
  "king-maker": { label: "Score handed over", format: score },
  "photo-finish": { label: "Score between the players", format: score },
  "touched-the-throne": { label: "Score at the top", format: score },
  "on-the-podium": { label: "Score on the podium", format: score },
  "marathon-set": { label: "Points of the set winner", format: points },
  "shootout": { label: "Points in the counted sets", format: points },
  "less-is-more": { label: "Points behind the loser", format: points },
  "leap-frog": { label: "Ranks jumped", format: (value) => `${fmtNum(value)} rank${value === 1 ? "" : "s"}` },
  "giant-hunting": { label: "Largest rank gap", format: (value) => `${fmtNum(value)} ranks` },
  "earliest-game": { label: "Time of the game", format: timeOfDay },
  "latest-game": { label: "Time of the game", format: timeOfDay },
  "perfect-day": { label: "Wins in the day", format: games },
  "group-stage-star": { label: "Wins in the group", format: games },
  "party-pooper": { label: "Wins spoiled", format: games },
  "full-house": { label: "Players beaten", format: (value) => `${fmtNum(value)} players` },
  "humbled": { label: "Players lost to", format: (value) => `${fmtNum(value)} players` },
  "everybodys-opponent": { label: "Players played", format: (value) => `${fmtNum(value)} players` },
  "full-coverage": { label: "Opponents in the season", format: (value) => `${fmtNum(value)} players` },
  "so-close": { label: "Share of the winner's score", format: (value) => `${fmtNum(value, { digits: 1 })}%` },
  "best-friends": { label: "Days to 50 games", format: days },
  "reunion": { label: "Days apart", format: days },
  "back-after-6-months": { label: "Days away", format: days },
  "back-after-1-year": { label: "Days away", format: days },
  "back-after-2-years": { label: "Days away", format: days },
  "back-from-the-dead": { label: "Days retired", format: days },
  "hat-trick": { label: "Minutes for 3 wins", format: (value) => `${fmtNum(Math.round(value))} min` },
  "anniversary": { label: "Years in the league", format: (value) => `${fmtNum(value)} year${value === 1 ? "" : "s"}` },
};

/**
 * The value of one earning, in the unit of its metric. The switch narrows the
 * data shape per type, so every case reads a field the type really has.
 */
export function achievementValue(achievement: Achievement): number | undefined {
  switch (achievement.type) {
    case "hero-of-the-day":
    case "hero-of-the-week":
    case "hero-of-the-month":
      return achievement.data.gamesPlayed;
    case "longest-win-streak":
    case "longest-lose-streak":
    case "yin-yang":
    case "streak-ender":
      return achievement.data.streakLength;
    case "david":
      return achievement.data.eloGain;
    case "goliath":
      return achievement.data.eloLoss;
    case "climber":
      return achievement.data.toElo - achievement.data.fromElo;
    case "king-maker":
      return achievement.data.netScoreGained;
    case "photo-finish":
      return achievement.data.eloDiff;
    case "touched-the-throne":
    case "on-the-podium":
      return achievement.data.elo;
    case "marathon-set":
      return achievement.data.setWinnerScore;
    case "shootout":
      return achievement.data.points;
    case "less-is-more":
      return achievement.data.opponentPoints - achievement.data.playerPoints;
    case "leap-frog":
      return achievement.data.ranksJumped;
    case "giant-hunting":
      // The day's biggest upset by rank. A better rank is a lower number, so
      // the gap the player closed is their own rank less the opponent's.
      return Math.max(...achievement.data.giants.map((giant) => giant.playerRank - giant.opponentRank));
    case "earliest-game":
    case "latest-game":
      return achievement.data.minutesIntoDay;
    case "perfect-day":
      return achievement.data.wins;
    case "group-stage-star":
      return achievement.data.wins;
    case "party-pooper":
      return achievement.data.opponentWins;
    case "full-house":
    case "humbled":
    case "everybodys-opponent":
      return achievement.data.count;
    case "full-coverage":
      return achievement.data.opponentCount;
    case "so-close":
      return (achievement.data.playerScore / achievement.data.winnerScore) * 100;
    case "best-friends":
      return (achievement.earnedAt - achievement.data.firstGame) / DAY_MS;
    case "reunion":
      return (achievement.earnedAt - achievement.data.lastGameAt) / DAY_MS;
    case "back-after-6-months":
    case "back-after-1-year":
    case "back-after-2-years":
      return (achievement.earnedAt - achievement.data.lastGameAt) / DAY_MS;
    case "back-from-the-dead":
      return (achievement.earnedAt - achievement.data.retiredAt) / DAY_MS;
    case "hat-trick":
      return (achievement.data.thirdWinAt - achievement.data.firstWinAt) / (60 * 1000);
    case "anniversary":
      return achievement.data.year;
    default:
      return undefined;
  }
}

/**
 * The achievements that hold a league record. Every earning of one of these
 * beat the value of the earning before it, so their earnings in order are the
 * history of the record.
 */
export const RECORD_ACHIEVEMENTS: AchievementType[] = [
  "hero-of-the-day",
  "hero-of-the-week",
  "hero-of-the-month",
  "longest-win-streak",
  "longest-lose-streak",
  "yin-yang",
  "david",
  "goliath",
  "marathon-set",
  "shootout",
  "leap-frog",
  "earliest-game",
  "latest-game",
];

export type RarityEntry = {
  type: AchievementType;
  /** How many times the achievement was earned, all players together. */
  earnings: number;
  /** How many players hold it. Rarity is ranked on this. */
  holders: number;
  /**
   * 1 is the rarest. Ties share the lowest rank of the tie, so two types with
   * the same number of holders both rank 2 when one type has fewer holders.
   */
  rank: number;
  /** How many types the rank counts, so the rank reads as "2 of 70". */
  total: number;
};

/** Earnings and holders per type, and the rarity rank across every type. */
export function rarityRanking(
  achievements: Achievement[],
  allTypes: AchievementType[],
): Map<AchievementType, RarityEntry> {
  const counts = new Map<AchievementType, { earnings: number; holders: Set<string> }>();
  allTypes.forEach((type) => counts.set(type, { earnings: 0, holders: new Set() }));

  achievements.forEach((achievement) => {
    const count = counts.get(achievement.type);
    if (!count) return;
    count.earnings += 1;
    count.holders.add(achievement.earnedBy);
  });

  const holderCounts = allTypes.map((type) => counts.get(type)!.holders.size);

  const ranking = new Map<AchievementType, RarityEntry>();
  allTypes.forEach((type) => {
    const holders = counts.get(type)!.holders.size;
    ranking.set(type, {
      type,
      earnings: counts.get(type)!.earnings,
      holders,
      rank: holderCounts.filter((other) => other < holders).length + 1,
      total: allTypes.length,
    });
  });
  return ranking;
}

export type HolderRow = {
  playerId: string;
  count: number;
  latestAt: number;
  /**
   * The holder's latest earning. The row describes it in full — the players a
   * Full House beat, the days a Best Friends took — the same way the recent
   * list describes an earning.
   */
  latest: Achievement;
};
export type MonthBucket = { monthKey: string; timestamp: number; count: number };
export type ValueBucket = { label: string; count: number };
export type CountRow = { key: string; count: number };

export type RecordStep = {
  value: number;
  /** Both players of a game earn some records, so a step can have two names. */
  holders: string[];
  at: number;
  /** When the next record replaced it. Undefined while the record stands. */
  heldUntil?: number;
};

export type TimeToEarn = {
  medianDays: number;
  fastest: { playerId: string; days: number };
  slowest: { playerId: string; days: number };
};

export type MeasuredValue = { value: number; playerId: string; at: number };

export type ValueSummary = {
  metric: AchievementMetric;
  highest: MeasuredValue;
  lowest: MeasuredValue;
  average: number;
  /** Every earning that has a value, highest first. */
  measured: MeasuredValue[];
  buckets: ValueBucket[];
};

export type AchievementDetails = {
  type: AchievementType;
  rarity: RarityEntry;
  /** The share of all players that hold it, 0 to 100. */
  holderShare: number;
  playerCount: number;
  isReachievable: boolean;
  first?: Achievement;
  latest?: Achievement;
  daysSinceLatest?: number;
  topHolders: HolderRow[];
  topOpponents: CountRow[];
  perMonth: MonthBucket[];
  timeToEarn?: TimeToEarn;
  values?: ValueSummary;
  recordHistory?: RecordStep[];
  perTournament: CountRow[];
  perSeason: CountRow[];
};

const HOLDER_ROWS = 5;
const OPPONENT_ROWS = 5;
const VALUE_BUCKETS = 8;

/** Everything the details view shows for one achievement type. */
export function achievementDetails(input: {
  type: AchievementType;
  /** Every earning of every type — the whole league. */
  allAchievements: Achievement[];
  allTypes: AchievementType[];
  playerCount: number;
  /** The first game of each player, for the time it takes to earn. */
  firstGameByPlayer: Map<string, number>;
  now: number;
}): AchievementDetails {
  const { type, allAchievements, allTypes, playerCount, firstGameByPlayer, now } = input;
  const earnings = allAchievements
    .filter((achievement) => achievement.type === type)
    .sort((a, b) => a.earnedAt - b.earnedAt);

  const rarity = rarityRanking(allAchievements, allTypes).get(type)!;
  const first = earnings[0];
  const latest = earnings[earnings.length - 1];

  return {
    type,
    rarity,
    holderShare: playerCount > 0 ? (rarity.holders / playerCount) * 100 : 0,
    playerCount,
    isReachievable: ACHIEVEMENT_IS_REACHIEVABLE[type],
    first,
    latest,
    // Calendar days, not elapsed time: an achievement earned at 23:00 last
    // night is 1 day old this morning, not 0.
    daysSinceLatest: latest ? calendarDaysBetween(latest.earnedAt, now) : undefined,
    topHolders: topHolders(earnings),
    topOpponents: topOpponents(earnings),
    perMonth: perMonth(earnings),
    timeToEarn: timeToEarn(earnings, firstGameByPlayer),
    values: valueSummary(type, earnings),
    recordHistory: RECORD_ACHIEVEMENTS.includes(type) ? recordHistory(earnings) : undefined,
    perTournament: groupCount(earnings, (achievement) =>
      achievement.data && "tournamentId" in achievement.data ? achievement.data.tournamentId : undefined,
    ),
    perSeason: groupCount(earnings, (achievement) =>
      achievement.data && "seasonStart" in achievement.data ? String(achievement.data.seasonStart) : undefined,
    ),
  };
}

function topHolders(earnings: Achievement[]): HolderRow[] {
  const byPlayer = new Map<string, HolderRow>();
  earnings.forEach((achievement) => {
    const row = byPlayer.get(achievement.earnedBy);
    if (row) {
      row.count += 1;
      if (achievement.earnedAt >= row.latestAt) {
        row.latestAt = achievement.earnedAt;
        row.latest = achievement;
      }
    } else {
      byPlayer.set(achievement.earnedBy, {
        playerId: achievement.earnedBy,
        count: 1,
        latestAt: achievement.earnedAt,
        latest: achievement,
      });
    }
  });
  return [...byPlayer.values()]
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt)
    .slice(0, HOLDER_ROWS);
}

/** Who was on the other side. Only the types that name an opponent have one. */
function topOpponents(earnings: Achievement[]): CountRow[] {
  return groupCount(earnings, (achievement) =>
    achievement.data && "opponent" in achievement.data ? achievement.data.opponent : undefined,
  ).slice(0, OPPONENT_ROWS);
}

function groupCount(earnings: Achievement[], key: (achievement: Achievement) => string | undefined): CountRow[] {
  const counts = new Map<string, number>();
  earnings.forEach((achievement) => {
    const value = key(achievement);
    if (value === undefined) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** One bucket per month from the first earning to the last, gaps included. */
export function perMonth(earnings: Achievement[]): MonthBucket[] {
  if (earnings.length === 0) return [];

  const counts = new Map<string, number>();
  earnings.forEach((achievement) => {
    counts.set(monthKey(achievement.earnedAt), (counts.get(monthKey(achievement.earnedAt)) ?? 0) + 1);
  });

  const start = new Date(earnings[0].earnedAt);
  const end = new Date(earnings[earnings.length - 1].earnedAt);
  const month = new Date(start.getFullYear(), start.getMonth(), 1);
  const buckets: MonthBucket[] = [];
  while (month.getTime() <= new Date(end.getFullYear(), end.getMonth(), 1).getTime()) {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    buckets.push({ monthKey: key, timestamp: month.getTime(), count: counts.get(key) ?? 0 });
    month.setMonth(month.getMonth() + 1);
  }
  return buckets;
}

function monthKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * How long a player plays before the first earning. A type earned in a
 * player's own first game gives 0 days for everybody, which says nothing, so
 * the caller drops a summary whose values are all 0.
 */
function timeToEarn(earnings: Achievement[], firstGameByPlayer: Map<string, number>): TimeToEarn | undefined {
  const firstEarnings = new Map<string, number>();
  earnings.forEach((achievement) => {
    if (!firstEarnings.has(achievement.earnedBy)) {
      firstEarnings.set(achievement.earnedBy, achievement.earnedAt);
    }
  });

  const spans = [...firstEarnings.entries()]
    .flatMap(([playerId, earnedAt]) => {
      const firstGame = firstGameByPlayer.get(playerId);
      if (firstGame === undefined) return [];
      return [{ playerId, days: Math.max(0, (earnedAt - firstGame) / DAY_MS) }];
    })
    .sort((a, b) => a.days - b.days);

  if (spans.length === 0 || spans[spans.length - 1].days === 0) return undefined;

  return {
    medianDays: median(spans.map((span) => span.days)),
    fastest: spans[0],
    slowest: spans[spans.length - 1],
  };
}

function median(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** The spread of the values, and the extremes that hold the ends of it. */
function valueSummary(type: AchievementType, earnings: Achievement[]): ValueSummary | undefined {
  const metric = ACHIEVEMENT_METRICS[type];
  if (!metric) return undefined;

  const measured = earnings.flatMap((achievement) => {
    const value = achievementValue(achievement);
    return value === undefined ? [] : [{ value, playerId: achievement.earnedBy, at: achievement.earnedAt }];
  });
  if (measured.length === 0) return undefined;

  const sorted = [...measured].sort((a, b) => a.value - b.value);
  return {
    metric,
    highest: sorted[sorted.length - 1],
    lowest: sorted[0],
    average: measured.reduce((sum, item) => sum + item.value, 0) / measured.length,
    measured: [...sorted].reverse(),
    buckets: valueBuckets(sorted.map((item) => item.value), metric),
  };
}

/**
 * A bucket per distinct value where the values are whole numbers that sit
 * close together, which keeps a streak length or a win count on its own bar.
 * Everything else falls into VALUE_BUCKETS ranges of equal width — a measure
 * such as the days a chase took has a distinct value for every earning, and a
 * bucket for each of them would make every bar 1 tall.
 */
export function valueBuckets(sortedValues: number[], metric: AchievementMetric): ValueBucket[] {
  const distinct = [...new Set(sortedValues)];
  const areWholeAndClose =
    distinct.every((value) => Number.isInteger(value)) &&
    distinct[distinct.length - 1] - distinct[0] < VALUE_BUCKETS * 2;
  if (distinct.length <= VALUE_BUCKETS && areWholeAndClose) {
    return distinct.map((value) => ({
      label: metric.format(value),
      count: sortedValues.filter((other) => other === value).length,
    }));
  }

  const lowest = sortedValues[0];
  const highest = sortedValues[sortedValues.length - 1];
  const width = (highest - lowest) / VALUE_BUCKETS;
  return Array.from({ length: VALUE_BUCKETS }, (_, index) => {
    const from = lowest + index * width;
    const to = index === VALUE_BUCKETS - 1 ? highest : from + width;
    return {
      label: `${metric.format(from)} – ${metric.format(to)}`,
      // The last bucket takes the highest value, so no value falls outside.
      count: sortedValues.filter((value) =>
        index === VALUE_BUCKETS - 1 ? value >= from : value >= from && value < to,
      ).length,
    };
  });
}

/**
 * The record over time. Both players of a game earn some records, so earnings
 * that share a time and a value are one step of the record.
 */
export function recordHistory(earnings: Achievement[]): RecordStep[] {
  const steps: RecordStep[] = [];
  earnings.forEach((achievement) => {
    const value = achievementValue(achievement);
    if (value === undefined) return;
    const previous = steps[steps.length - 1];
    if (previous && previous.at === achievement.earnedAt && previous.value === value) {
      previous.holders.push(achievement.earnedBy);
      return;
    }
    steps.push({ value, holders: [achievement.earnedBy], at: achievement.earnedAt });
  });

  steps.forEach((step, index) => {
    const next = steps[index + 1];
    if (next) step.heldUntil = next.at;
  });
  return steps;
}

export type LeaguePlayerRow = { playerId: string; types: number; earnings: number };

export type LeagueAchievementStats = {
  totalEarnings: number;
  /** How many players hold at least one achievement. */
  playersWithAchievements: number;
  earnedTypes: number;
  totalTypes: number;
  rarest: RarityEntry[];
  mostCommon: RarityEntry[];
  neverEarned: AchievementType[];
  topPlayers: LeaguePlayerRow[];
  perMonth: MonthBucket[];
};

const LEAGUE_ROWS = 5;

/** The whole league, for the details view with no achievement selected. */
export function leagueAchievementStats(input: {
  allAchievements: Achievement[];
  allTypes: AchievementType[];
}): LeagueAchievementStats {
  const { allAchievements, allTypes } = input;
  const ranking = [...rarityRanking(allAchievements, allTypes).values()];
  const earned = ranking.filter((entry) => entry.holders > 0);

  const byPlayer = new Map<string, { types: Set<AchievementType>; earnings: number }>();
  allAchievements.forEach((achievement) => {
    const row = byPlayer.get(achievement.earnedBy) ?? { types: new Set<AchievementType>(), earnings: 0 };
    row.types.add(achievement.type);
    row.earnings += 1;
    byPlayer.set(achievement.earnedBy, row);
  });

  return {
    totalEarnings: allAchievements.length,
    playersWithAchievements: byPlayer.size,
    earnedTypes: earned.length,
    totalTypes: allTypes.length,
    rarest: [...earned].sort((a, b) => a.holders - b.holders).slice(0, LEAGUE_ROWS),
    mostCommon: [...earned].sort((a, b) => b.holders - a.holders).slice(0, LEAGUE_ROWS),
    neverEarned: ranking.filter((entry) => entry.holders === 0).map((entry) => entry.type),
    topPlayers: [...byPlayer.entries()]
      .map(([playerId, row]) => ({ playerId, types: row.types.size, earnings: row.earnings }))
      .sort((a, b) => b.types - a.types || b.earnings - a.earnings)
      .slice(0, LEAGUE_ROWS),
    perMonth: perMonth([...allAchievements].sort((a, b) => a.earnedAt - b.earnedAt)),
  };
}
