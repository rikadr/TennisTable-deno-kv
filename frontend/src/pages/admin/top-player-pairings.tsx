import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";

interface PairingData {
  key: string;
  player1: string;
  player2: string;
  count: number;
}

export const TopPlayerPairings: React.FC = () => {
  const context = useEventDbContext();

  const topPairings = useMemo<PairingData[]>(() => {
    const counts = new Map<string, PairingData>();

    context.games.forEach(({ winner, loser }) => {
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

    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [context.games]);

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-4">Top 10 Player Pairings</h2>
      {topPairings.length === 0 ? (
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg">
          <p>No games data available</p>
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
            {topPairings.map((pairing, index) => {
              const maxCount = topPairings[0].count;
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
    </div>
  );
};
