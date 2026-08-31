import React, { useMemo, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import {
  Period,
  PERIOD_LABELS,
  getPeriodKey,
  getPeriodTimestamp,
  getPeriodStart,
  advancePeriod,
  formatPeriod,
  pairingKey,
} from "../../common/period-utils";

type Metric = "games" | "activePlayers" | "pairings" | "achievements";

interface PeriodData {
  key: string;
  count: number;
  timestamp: number;
}

interface CurrentEntry {
  rank: number;
  total: number;
  entry: PeriodData;
}

interface TopPeriodsResult {
  top: PeriodData[];
  current: CurrentEntry | null;
}

const METRIC_LABELS: Record<Metric, { option: string; column: string }> = {
  games: { option: "Games played", column: "Games" },
  activePlayers: { option: "Active players", column: "Players" },
  pairings: { option: "Player pairings", column: "Pairings" },
  achievements: { option: "Achievements earned", column: "Achievements" },
};

// With a single player selected, "active players" in their games means their unique
// opponents, and "pairings" would count the exact same thing — so it is not offered.
const PLAYER_METRIC_LABELS: Record<Exclude<Metric, "pairings">, { option: string; column: string }> = {
  games: { option: "Games played", column: "Games" },
  activePlayers: { option: "Unique opponents", column: "Opponents" },
  achievements: { option: "Achievements earned", column: "Achievements" },
};

const RECENT_WINDOW_MS: Record<Period, number> = {
  day: 6 * 30 * 24 * 60 * 60 * 1000, // 6 months
  week: 365 * 24 * 60 * 60 * 1000, // 1 year
  month: 2 * 365 * 24 * 60 * 60 * 1000, // 2 years
  year: 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
};

const RECENT_WINDOW_LABELS: Record<Period, string> = {
  day: "Last 6 Months",
  week: "Last Year",
  month: "Last 2 Years",
  year: "Last 10 Years",
};

/**
 * Everything needed to count any of the metrics for one period. Games and achievements are
 * running totals, while the two "unique" metrics need the members themselves so repeats are
 * not counted twice.
 */
interface PeriodBucket {
  timestamp: number;
  games: number;
  players: Set<string>;
  pairings: Set<string>;
  achievements: number;
}

const emptyBucket = (timestamp: number): PeriodBucket => ({
  timestamp,
  games: 0,
  players: new Set(),
  pairings: new Set(),
  achievements: 0,
});

const getBucket = (map: Map<string, PeriodBucket>, key: string, timestamp: number): PeriodBucket => {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = emptyBucket(timestamp);
    map.set(key, bucket);
  }
  return bucket;
};

const addGameToBucket = (
  map: Map<string, PeriodBucket>,
  key: string,
  timestamp: number,
  winner: string,
  loser: string,
  excludedPlayer: string | null,
) => {
  const bucket = getBucket(map, key, timestamp);
  bucket.games++;
  if (winner !== excludedPlayer) bucket.players.add(winner);
  if (loser !== excludedPlayer) bucket.players.add(loser);
  bucket.pairings.add(pairingKey(winner, loser));
};

const addAchievementToBucket = (map: Map<string, PeriodBucket>, key: string, timestamp: number) => {
  getBucket(map, key, timestamp).achievements++;
};

const bucketCount = (bucket: PeriodBucket, metric: Metric): number => {
  switch (metric) {
    case "games":
      return bucket.games;
    case "activePlayers":
      return bucket.players.size;
    case "pairings":
      return bucket.pairings.size;
    case "achievements":
      return bucket.achievements;
  }
};

export const TopGamingDays: React.FC = () => {
  const context = useEventDbContext();
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<Metric>("games");
  const [playerId, setPlayerId] = useState<string>("");

  const players = useMemo(() => [...context.allPlayers].sort((a, b) => a.name.localeCompare(b.name)), [context]);

  const recentCutoff = useMemo(() => Date.now() - RECENT_WINDOW_MS[period], [period]);

  const currentKey = useMemo(() => getPeriodKey(new Date(), period), [period]);

  const { topAllTime, topRecent } = useMemo(() => {
    const empty: TopPeriodsResult = { top: [], current: null };
    const games = playerId
      ? context.games.filter(({ winner, loser }) => winner === playerId || loser === playerId)
      : context.games;
    if (games.length === 0) {
      return { topAllTime: empty, topRecent: empty };
    }

    const allTimeBuckets = new Map<string, PeriodBucket>();
    const recentBuckets = new Map<string, PeriodBucket>();

    // The selected player is in every one of their games, so counting them as an
    // "active player" would only shift the opponent count by one.
    const excludedPlayer = playerId || null;

    let earliestPlayedAt = Infinity;

    games.forEach(({ playedAt, winner, loser }) => {
      if (playedAt < earliestPlayedAt) {
        earliestPlayedAt = playedAt;
      }

      const date = new Date(playedAt);
      const key = getPeriodKey(date, period);
      const timestamp = getPeriodTimestamp(date, period);

      addGameToBucket(allTimeBuckets, key, timestamp, winner, loser, excludedPlayer);

      if (playedAt >= recentCutoff) {
        addGameToBucket(recentBuckets, key, timestamp, winner, loser, excludedPlayer);
      }
    });

    // Achievements are not derived from the game loop above — they carry their own
    // earnedAt — so they get a second pass, and only when they are the selected metric
    // since calculating them the first time is expensive.
    if (metric === "achievements") {
      context.achievements.calculateAchievements();
      context.achievements.achievementMap.forEach((playerAchievements, achievementPlayerId) => {
        if (playerId && achievementPlayerId !== playerId) {
          return;
        }
        playerAchievements.forEach(({ earnedAt }) => {
          const date = new Date(earnedAt);
          const key = getPeriodKey(date, period);
          const timestamp = getPeriodTimestamp(date, period);

          addAchievementToBucket(allTimeBuckets, key, timestamp);

          if (earnedAt >= recentCutoff) {
            addAchievementToBucket(recentBuckets, key, timestamp);
          }
        });
      });
    }

    // Seed every calendar period in the range with an empty bucket so that periods
    // with no games are still considered (including the current, possibly empty, period).
    const now = new Date();
    const seedRange = (map: Map<string, PeriodBucket>, rangeStart: number) => {
      let cursor = getPeriodStart(new Date(rangeStart), period);
      const endTimestamp = getPeriodTimestamp(now, period);
      while (cursor.getTime() <= endTimestamp) {
        const key = getPeriodKey(cursor, period);
        if (!map.has(key)) {
          map.set(key, emptyBucket(getPeriodTimestamp(cursor, period)));
        }
        cursor = advancePeriod(cursor, period);
      }
    };

    seedRange(allTimeBuckets, earliestPlayedAt);
    seedRange(recentBuckets, Math.max(earliestPlayedAt, recentCutoff));

    const buildResult = (map: Map<string, PeriodBucket>): TopPeriodsResult => {
      const sorted = Array.from(map.entries())
        .map(([key, bucket]) => ({
          key,
          count: bucketCount(bucket, metric),
          timestamp: bucket.timestamp,
        }))
        // Highest count first, ties broken in favour of the earlier period.
        .sort((a, b) => b.count - a.count || a.timestamp - b.timestamp);

      const currentIndex = sorted.findIndex((entry) => entry.key === currentKey);
      const current: CurrentEntry | null =
        currentIndex >= 0 ? { rank: currentIndex + 1, total: sorted.length, entry: sorted[currentIndex] } : null;

      return { top: sorted.slice(0, 10), current };
    };

    return {
      topAllTime: buildResult(allTimeBuckets),
      topRecent: buildResult(recentBuckets),
    };
  }, [context.games, context.achievements, period, metric, playerId, recentCutoff, currentKey]);

  const periodLabel = PERIOD_LABELS[period];
  const metricLabel = playerId && metric !== "pairings" ? PLAYER_METRIC_LABELS[metric] : METRIC_LABELS[metric];

  if (context.games.length === 0) {
    return (
      <div className="bg-primary-background text-primary-text rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">Top Gaming {periodLabel.plural}</h2>
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg">
          <p>No games data available</p>
        </div>
      </div>
    );
  }

  const TopPeriodsTable = ({ title, data }: { title: string; data: TopPeriodsResult }) => {
    const now = Date.now();
    const windowMs = RECENT_WINDOW_MS[period];
    const { top, current } = data;
    const maxCount = top.length > 0 ? top[0].count : 0;

    // A current period outside the top 10 gets its own row below, which already spells out
    // "rank / total". When it made the top 10 that row is absent, so the table never says how
    // many periods it was ranked against — this summary row supplies the denominator. Pointless
    // when every period is already listed, so it needs more than the 10 shown.
    const showRankSummary = current !== null && current.rank <= 10 && current.total > 10;

    const renderRow = (entry: PeriodData, rank: number, total: number | null) => {
      const ageMs = now - entry.timestamp;
      const recencyPercent = Math.max(0, Math.min(100, (1 - ageMs / windowMs) * 100));
      const countPercent = maxCount > 0 ? Math.max(0, Math.min(100, (entry.count / maxCount) * 100)) : 0;
      const isCurrent = entry.key === currentKey;

      return (
        <tr
          key={entry.key}
          className={isCurrent ? "bg-tertiary-background text-tertiary-text" : "hover:bg-secondary-background/50"}
        >
          <td className="px-2 py-1 border border-primary-text/20 font-medium whitespace-nowrap">
            {total !== null ? `${rank} / ${total}` : rank}
          </td>
          <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
            {formatPeriod(entry.timestamp, period)}
          </td>
          <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap relative overflow-hidden">
            {relativeTimeString(new Date(entry.timestamp))}
            <div
              className={`absolute bottom-0 left-0 h-[2px] ${isCurrent ? "bg-tertiary-text" : "bg-current"}`}
              style={{ width: `${recencyPercent}%` }}
            />
          </td>
          <td className="px-2 py-1 border border-primary-text/20 text-right font-bold relative overflow-hidden">
            {entry.count}
            <div
              className={`absolute bottom-0 left-0 h-[2px] ${isCurrent ? "bg-tertiary-text" : "bg-current"}`}
              style={{ width: `${countPercent}%` }}
            />
          </td>
        </tr>
      );
    };

    return (
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        {top.length === 0 ? (
          <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg text-xs">
            No data for this period
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary-background text-secondary-text">
                <th className="px-2 py-1 text-left border border-primary-text/20">#</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">{periodLabel.singular}</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">When</th>
                <th className="px-2 py-1 text-right border border-primary-text/20">{metricLabel.column}</th>
              </tr>
            </thead>
            <tbody>
              {top.map((entry, index) => renderRow(entry, index + 1, null))}
              {current && current.rank > 10 && renderRow(current.entry, current.rank, current.total)}
              {showRankSummary && (
                <tr className="text-primary-text/70">
                  <td className="px-2 py-1 border border-primary-text/20 font-medium whitespace-nowrap">
                    {current.rank} / {current.total}
                  </td>
                  <td colSpan={3} className="px-2 py-1 border border-primary-text/20">
                    Current {periodLabel.singular.toLowerCase()} rank
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Top Gaming {periodLabel.plural}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={playerId}
            onChange={(e) => {
              const newPlayerId = e.target.value;
              // Pairings is not offered per player (it equals unique opponents there),
              // so fall over to the closest metric instead of an invalid selection.
              if (newPlayerId && metric === "pairings") {
                setMetric("activePlayers");
              }
              setPlayerId(newPlayerId);
            }}
            aria-label="Filter by player"
            className="px-2 py-1 text-xs border rounded border-primary-text/20 bg-primary-background max-w-40"
          >
            <option value="">All players</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
                {player.active ? "" : " (deactivated)"}
              </option>
            ))}
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            aria-label="Metric to count"
            className="px-2 py-1 text-xs border rounded border-primary-text/20 bg-primary-background"
          >
            {(Object.keys(playerId ? PLAYER_METRIC_LABELS : METRIC_LABELS) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {(playerId && m !== "pairings" ? PLAYER_METRIC_LABELS[m] : METRIC_LABELS[m]).option}
              </option>
            ))}
          </select>
          <div className="flex gap-1" role="tablist" aria-label="Group by period">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded border border-primary-text/20 transition-colors ${
                  period === p
                    ? "bg-secondary-background text-secondary-text font-semibold"
                    : "bg-primary-background hover:bg-secondary-background/50"
                }`}
              >
                {PERIOD_LABELS[p].plural}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <TopPeriodsTable title="All Time" data={topAllTime} />
        <TopPeriodsTable title={RECENT_WINDOW_LABELS[period]} data={topRecent} />
      </div>
      {(topAllTime.current || topRecent.current) && (
        <div className="mt-3 text-xs flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-tertiary-background border border-primary-text/20" />
          <span>Current {periodLabel.singular.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
};
