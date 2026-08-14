import React, { useMemo } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { FACTORS } from "../hall-of-fame/hall-of-fame-player-page";
import { fmtNum } from "../../common/number-utils";

export const HallOfFameCategoryBalance: React.FC = () => {
  const context = useEventDbContext();

  const { rows, grandTotal, playerCount } = useMemo(() => {
    const entries = context.hallOfFame.getFullHypotheticalLeaderboard();

    const totals = new Map<HallOfFameFactorKey, number>();
    for (const factor of FACTORS) {
      totals.set(factor.key, 0);
    }
    for (const entry of entries) {
      for (const factor of FACTORS) {
        totals.set(factor.key, (totals.get(factor.key) ?? 0) + entry.score[factor.key].score);
      }
    }

    const grandTotal = Array.from(totals.values()).reduce((sum, score) => sum + score, 0);

    const rows = FACTORS.map((factor) => ({
      ...factor,
      total: totals.get(factor.key) ?? 0,
    })).sort((a, b) => b.total - a.total);

    return { rows, grandTotal, playerCount: entries.length };
  }, [context.hallOfFame]);

  const maxTotal = rows[0]?.total ?? 0;

  return (
    <div className="bg-primary-background text-primary-text rounded-lg my-6">
      <h2 className="text-xl font-semibold text-center mb-1">Hall of Fame score per category</h2>
      <p className="text-sm text-center opacity-75 mb-4">
        Sum over all players, active and retired. An even spread means the categories are balanced.
      </p>

      <div className="max-w-3xl mx-auto space-y-1.5 px-4">
        {rows.map((row) => {
          const share = grandTotal > 0 ? (row.total / grandTotal) * 100 : 0;
          const barWidth = maxTotal > 0 ? (row.total / maxTotal) * 100 : 0;
          return (
            <div key={row.key} className="grid grid-cols-[12rem_1fr_9rem] items-center gap-2 text-sm">
              <div className="truncate">
                {row.emoji} {row.name}
              </div>
              <div className="h-5 rounded bg-secondary-background/40">
                <div
                  className="h-5 rounded bg-tertiary-background"
                  style={{ width: `${Math.max(barWidth, row.total > 0 ? 1 : 0)}%` }}
                />
              </div>
              <div className="text-right tabular-nums whitespace-nowrap">
                {fmtNum(Math.round(row.total))} <span className="opacity-60">({share.toFixed(1)}%)</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-sm text-center opacity-75">
        Players: {fmtNum(playerCount)} | Total points: {fmtNum(Math.round(grandTotal))}
      </div>
    </div>
  );
};
