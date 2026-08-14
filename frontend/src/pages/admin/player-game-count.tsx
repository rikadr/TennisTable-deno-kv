import React, { useMemo, useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";

export const PlayerGameCount: React.FC = () => {
  const context = useEventDbContext();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  const players = useMemo(
    () =>
      [...context.allPlayers].sort((a, b) => {
        if (a.active !== b.active) {
          return a.active ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      }),
    [context],
  );

  const visiblePlayers = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return players;
    }
    return players.filter((player) => player.name.toLowerCase().includes(query));
  }, [players, filter]);

  const totalGames = context.games.length;

  const { anyCount, bothCount } = useMemo(() => {
    if (selectedIds.size === 0) {
      return { anyCount: 0, bothCount: 0 };
    }
    let anyCount = 0;
    let bothCount = 0;
    context.games.forEach(({ winner, loser }) => {
      const winnerSelected = selectedIds.has(winner);
      const loserSelected = selectedIds.has(loser);
      if (winnerSelected || loserSelected) {
        anyCount++;
      }
      if (winnerSelected && loserSelected) {
        bothCount++;
      }
    });
    return { anyCount, bothCount };
  }, [context.games, selectedIds]);

  const togglePlayer = (playerId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const anyPercent = totalGames > 0 ? ((anyCount / totalGames) * 100).toFixed(1) : "0.0";

  return (
    <div className="bg-primary-background text-primary-text rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Player Game Count</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter players..."
            aria-label="Filter players"
            className="px-2 py-1 text-xs border rounded border-primary-text/20 bg-primary-background"
          />
          <button
            type="button"
            onClick={() => setSelectedIds(new Set(players.map((player) => player.id)))}
            className="px-3 py-1 text-xs rounded border border-primary-text/20 bg-primary-background hover:bg-secondary-background/50 transition-colors"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
            className="px-3 py-1 text-xs rounded border border-primary-text/20 bg-primary-background hover:bg-secondary-background/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>
      <p className="text-xs text-primary-text/70 mb-2">
        Select players to count the games where at least one of them played.
      </p>
      <div className="flex flex-wrap gap-1 mb-4 max-h-48 overflow-y-auto">
        {visiblePlayers.length === 0 ? (
          <span className="text-xs text-primary-text/70 p-1">No players match the filter</span>
        ) : (
          visiblePlayers.map((player) => {
            const isSelected = selectedIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => togglePlayer(player.id)}
                className={`px-3 py-1 text-xs rounded border border-primary-text/20 transition-colors whitespace-nowrap ${
                  isSelected
                    ? "bg-secondary-background text-secondary-text font-semibold"
                    : "bg-primary-background hover:bg-secondary-background/50"
                }`}
              >
                {player.name}
                {!player.active && <span className="opacity-50"> 🪦</span>}
              </button>
            );
          })
        )}
      </div>
      {selectedIds.size === 0 ? (
        <div className="text-center text-primary-text p-4 bg-secondary-background rounded-lg text-xs">
          No players selected
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          <div className="bg-secondary-background text-secondary-text rounded-lg p-4 flex-1 min-w-48">
            <div className="text-3xl font-bold">{fmtNum(anyCount)}</div>
            <div className="text-xs mt-1">
              Games with at least 1 of the {fmtNum(selectedIds.size)} selected players ({anyPercent}% of{" "}
              {fmtNum(totalGames)} games)
            </div>
          </div>
          <div className="bg-secondary-background text-secondary-text rounded-lg p-4 flex-1 min-w-48">
            <div className="text-3xl font-bold">{fmtNum(bothCount)}</div>
            <div className="text-xs mt-1">Games where both players are among the selected</div>
          </div>
        </div>
      )}
    </div>
  );
};
