import React, { useMemo, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeStringShort } from "../../common/date-utils";
import { Period, PERIOD_LABELS, getPeriodKey, getPeriodTimestamp, formatPeriod, pairingKey } from "./period-utils";

type Metric = "games" | "pairings" | "achievements";

const METRIC_LABELS: Record<Metric, { option: string; column: string }> = {
  games: { option: "Games played", column: "Games" },
  pairings: { option: "Player pairings", column: "Pairings" },
  achievements: { option: "Achievements earned", column: "Achievements" },
};

interface PlayerBucket {
  key: string;
  timestamp: number;
  games: number;
  pairings: Set<string>;
  achievements: number;
}

interface PlayerBestEntry {
  playerId: string;
  key: string;
  timestamp: number;
  count: number;
}

const bucketCount = (bucket: PlayerBucket, metric: Metric): number => {
  switch (metric) {
    case "games":
      return bucket.games;
    case "pairings":
      return bucket.pairings.size;
    case "achievements":
      return bucket.achievements;
  }
};

export const TopPlayers: React.FC = () => {
  const context = useEventDbContext();
  const [period, setPeriod] = useState<Period>("day");
  const [metric, setMetric] = useState<Metric>("games");

  const currentKey = useMemo(() => getPeriodKey(new Date(), period), [period]);

  const inactivePlayerIds = useMemo(
    () => new Set(context.allPlayers.filter((player) => !player.active).map((player) => player.id)),
    [context],
  );

  const rows = useMemo(() => {
    const playerBuckets = new Map<string, Map<string, PlayerBucket>>();

    const getBucket = (playerId: string, key: string, timestamp: number): PlayerBucket => {
      let buckets = playerBuckets.get(playerId);
      if (!buckets) {
        buckets = new Map();
        playerBuckets.set(playerId, buckets);
      }
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { key, timestamp, games: 0, pairings: new Set(), achievements: 0 };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    if (metric === "achievements") {
      // Achievements carry their own earnedAt and are expensive to calculate,
      // so they are only projected when they are the selected metric.
      context.achievements.calculateAchievements();
      context.achievements.achievementMap.forEach((playerAchievements, playerId) => {
        playerAchievements.forEach(({ earnedAt }) => {
          const date = new Date(earnedAt);
          getBucket(playerId, getPeriodKey(date, period), getPeriodTimestamp(date, period)).achievements++;
        });
      });
    } else {
      context.games.forEach(({ playedAt, winner, loser }) => {
        const date = new Date(playedAt);
        const key = getPeriodKey(date, period);
        const timestamp = getPeriodTimestamp(date, period);
        const pairing = pairingKey(winner, loser);

        for (const playerId of [winner, loser]) {
          const bucket = getBucket(playerId, key, timestamp);
          bucket.games++;
          bucket.pairings.add(pairing);
        }
      });
    }

    const best: PlayerBestEntry[] = [];
    playerBuckets.forEach((buckets, playerId) => {
      let bestEntry: PlayerBestEntry | null = null;
      for (const bucket of Array.from(buckets.values())) {
        const count = bucketCount(bucket, metric);
        // Highest count wins, ties broken in favour of the earlier period.
        if (
          !bestEntry ||
          count > bestEntry.count ||
          (count === bestEntry.count && bucket.timestamp < bestEntry.timestamp)
        ) {
          bestEntry = { playerId, key: bucket.key, timestamp: bucket.timestamp, count };
        }
      }
      if (bestEntry !== null && bestEntry.count > 0) {
        best.push(bestEntry);
      }
    });

    return best.sort(
      (a, b) =>
        b.count - a.count ||
        a.timestamp - b.timestamp ||
        context.playerName(a.playerId).localeCompare(context.playerName(b.playerId)),
    );
  }, [context, metric, period]);

  const periodLabel = PERIOD_LABELS[period];
  const metricLabel = METRIC_LABELS[metric];
  const maxCount = rows.length > 0 ? rows[0].count : 0;
  const hasCurrent = rows.some((row) => row.key === currentKey);

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Top Players</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
            aria-label="Metric to count"
            className="px-2 py-1 text-xs border rounded border-primary-text/20 bg-primary-background"
          >
            {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m].option}
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
      <p className="text-xs text-primary-text/70 mb-2">
        Each player's best {periodLabel.singular.toLowerCase()} by {metricLabel.option.toLowerCase()}.
      </p>
      {rows.length === 0 ? (
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg text-xs">
          No data available
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-secondary-background text-secondary-text">
                <th className="px-2 py-1 text-left border border-primary-text/20">#</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">Player</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">Best {periodLabel.singular}</th>
                <th className="px-2 py-1 text-left border border-primary-text/20">When</th>
                <th className="px-2 py-1 text-right border border-primary-text/20">{metricLabel.column}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const isCurrent = row.key === currentKey;
                const countPercent = maxCount > 0 ? Math.max(0, Math.min(100, (row.count / maxCount) * 100)) : 0;

                return (
                  <tr
                    key={row.playerId}
                    className={
                      isCurrent ? "bg-tertiary-background text-tertiary-text" : "hover:bg-secondary-background/50"
                    }
                  >
                    <td className="px-2 py-1 border border-primary-text/20 font-medium whitespace-nowrap">
                      {index + 1}
                    </td>
                    <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
                      {context.playerName(row.playerId)}
                      {inactivePlayerIds.has(row.playerId) && <span className="text-primary-text/50"> (🪦)</span>}
                    </td>
                    <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
                      {formatPeriod(row.timestamp, period, "short")}
                    </td>
                    <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
                      {relativeTimeStringShort(new Date(row.timestamp))}
                    </td>
                    <td className="px-2 py-1 border border-primary-text/20 text-right font-bold relative overflow-hidden">
                      {row.count}
                      <div
                        className={`absolute bottom-0 left-0 h-[2px] ${isCurrent ? "bg-tertiary-text" : "bg-current"}`}
                        style={{ width: `${countPercent}%` }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {hasCurrent && (
        <div className="mt-3 text-xs flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-sm bg-tertiary-background border border-primary-text/20" />
          <span>Best {periodLabel.singular.toLowerCase()} is the current {periodLabel.singular.toLowerCase()}</span>
        </div>
      )}
    </div>
  );
};
