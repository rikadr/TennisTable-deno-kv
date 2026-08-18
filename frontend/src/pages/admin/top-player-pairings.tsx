import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { getRangeCutoff, TimeRange, TIME_RANGE_LABELS } from "../../common/time-range";

interface PairingData {
  key: string;
  player1: string;
  player2: string;
  count: number;
}

export const TopPlayerPairings: React.FC = () => {
  const context = useEventDbContext();
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [showAll, setShowAll] = useState(false);

  const pairings = useMemo<PairingData[]>(() => {
    const cutoff = getRangeCutoff(timeRange, new Date());
    const counts = new Map<string, PairingData>();

    context.games.forEach(({ playedAt, winner, loser }) => {
      if (playedAt < cutoff) {
        return;
      }

      // Normalize the pair so that (a, b) and (b, a) count as the same pairing.
      const [player1, player2] = [winner, loser].sort();
      const key = `${player1}::${player2}`;

      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { key, player1, player2, count: 1 });
      }
    });

    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [context.games, timeRange]);

  const visiblePairings = showAll ? pairings : pairings.slice(0, 10);

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Top Player Pairings</h2>
        <div className="flex gap-1" role="tablist" aria-label="Filter by time range">
          {(Object.keys(TIME_RANGE_LABELS) as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              role="tab"
              aria-selected={timeRange === range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs rounded border border-primary-text/20 transition-colors ${
                timeRange === range
                  ? "bg-secondary-background text-secondary-text font-semibold"
                  : "bg-primary-background hover:bg-secondary-background/50"
              }`}
            >
              {TIME_RANGE_LABELS[range]}
            </button>
          ))}
        </div>
      </div>
      {pairings.length === 0 ? (
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg">
          <p>{timeRange === "all" ? "No games data available" : "No games in this time range"}</p>
        </div>
      ) : (
        <table className="w-full text-xs md:text-sm border-collapse">
          <thead>
            <tr className="bg-secondary-background text-secondary-text">
              <th className="px-2 py-1 text-left border border-primary-text/20">#</th>
              <th className="px-2 py-1 text-left border border-primary-text/20">Pairing</th>
              <th className="px-2 py-1 text-right border border-primary-text/20">Games</th>
            </tr>
          </thead>
          <tbody>
            {visiblePairings.map((pairing, index) => {
              const maxCount = pairings[0].count;
              const countPercent = maxCount > 0 ? Math.max(0, Math.min(100, (pairing.count / maxCount) * 100)) : 0;
              return (
                <tr key={pairing.key} className="hover:bg-secondary-background/50">
                  <td className="px-2 py-1 border border-primary-text/20 font-medium whitespace-nowrap">
                    {index + 1}
                  </td>
                  <td className="px-2 py-1 border border-primary-text/20 whitespace-nowrap">
                    <Link to={`/1v1?player1=${pairing.player1}&player2=${pairing.player2}`} className="hover:underline">
                      {context.playerName(pairing.player1)} &amp; {context.playerName(pairing.player2)}
                    </Link>
                  </td>
                  <td className="px-2 py-1 border border-primary-text/20 text-right font-bold relative overflow-hidden">
                    {pairing.count}
                    <div
                      className="absolute bottom-0 left-0 h-[2px] bg-current"
                      style={{ width: `${countPercent}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {pairings.length > 10 && (
        <div className="flex justify-center mt-3">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="px-3 py-1 text-xs rounded border border-primary-text/20 bg-primary-background hover:bg-secondary-background/50 transition-colors"
          >
            {showAll ? "Show top 10" : `Show all ${pairings.length}`}
          </button>
        </div>
      )}
    </div>
  );
};
