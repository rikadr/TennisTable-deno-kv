import { useState } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";
import { fmtNum } from "../../common/number-utils";
import { Season } from "../../client/client-db/seasons/season";

type DisplayMetric = "seasonScore" | "playerPairings" | "avgPerformance";
type SortMetric = "seasonScore" | "playerPairings" | "avgPerformance";

type Props = {
  season: Season;
};

export const SeasonLeaderboardBars = ({ season }: Props) => {
  const context = useEventDbContext();
  const [displayMetric, setDisplayMetric] = useState<DisplayMetric>("seasonScore");
  const [sortMetric, setSortMetric] = useState<SortMetric>("seasonScore");

  const leaderboard = season.getLeaderboard();

  // Calculate display values and sort
  const playersWithMetrics = leaderboard.map((player) => ({
    playerId: player.playerId,
    seasonScore: player.seasonScore,
    playerPairings: player.matchups.size,
    avgPerformance: player.seasonScore / player.matchups.size,
  }));

  // Sort based on selected metric
  const sortedPlayers = [...playersWithMetrics].sort((a, b) => {
    return b[sortMetric] - a[sortMetric];
  });

  // Create a map of playerId to sort order
  const playerOrder = new Map(sortedPlayers.map((player, index) => [player.playerId, index]));

  // Find max value for the displayed metric to calculate bar widths
  const maxValue = Math.max(...sortedPlayers.map((p) => p[displayMetric]));

  const getMetricValue = (playerId: string, metric: DisplayMetric): number => {
    const player = playersWithMetrics.find((p) => p.playerId === playerId);
    return player?.[metric] || 0;
  };

  return (
    <div className="flex flex-col gap-4 w-full my-6">
      {/* Selectors */}
      <div className="flex flex-col sm:flex-row gap-4 bg-secondary-background p-4 pb-2 rounded-lg">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-secondary-text font-medium">Display:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setDisplayMetric("seasonScore")}
              onDoubleClick={() => setSortMetric("seasonScore")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                displayMetric === "seasonScore"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Season Score
            </button>
            <button
              onClick={() => setDisplayMetric("playerPairings")}
              onDoubleClick={() => setSortMetric("playerPairings")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                displayMetric === "playerPairings"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Pairings
            </button>
            <button
              onClick={() => setDisplayMetric("avgPerformance")}
              onDoubleClick={() => setSortMetric("avgPerformance")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                displayMetric === "avgPerformance"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Avg. %
            </button>
          </div>
          <p className="text-secondary-text italic text-xs">Double click to set both</p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm text-secondary-text font-medium">Sort by:</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSortMetric("seasonScore")}
              onDoubleClick={() => setDisplayMetric("seasonScore")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                sortMetric === "seasonScore"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Season Score
            </button>
            <button
              onClick={() => setSortMetric("playerPairings")}
              onDoubleClick={() => setDisplayMetric("playerPairings")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                sortMetric === "playerPairings"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Pairings
            </button>
            <button
              onClick={() => setSortMetric("avgPerformance")}
              onDoubleClick={() => setDisplayMetric("avgPerformance")}
              className={classNames(
                "px-3 py-1.5 rounded text-sm transition-colors",
                sortMetric === "avgPerformance"
                  ? "bg-treasury-background text-treasury-text font-medium ring-1 ring-secondary-text"
                  : "bg-primary-background text-secondary-text hover:text-primary-text",
              )}
            >
              Avg. %
            </button>
          </div>
        </div>
      </div>

      {/* Bars */}
      <div className="flex flex-col w-full bg-primary-background rounded-lg overflow-hidden">
        {playersWithMetrics.map(({ playerId }) => {
          const value = getMetricValue(playerId, displayMetric);
          const fraction = value / maxValue;
          const order = playerOrder.get(playerId) ?? 0;
          const rank = order + 1;

          return (
            <Link
              to={`/player/${playerId}`}
              className="group border-b border-primary-text/20 last:border-b-0 transition-all duration-500"
              key={playerId}
              style={{
                order: order,
              }}
            >
              <div className="relative w-full h-6 group-hover:bg-primary-text/5">
                <div
                  className="absolute h-6 group-hover:opacity-75 top-0 transition-all duration-500 left-0 rounded-r-md"
                  style={{
                    width: `${fraction * 100}%`,
                    backgroundColor: stringToColor(playerId),
                  }}
                />
                <div className="absolute top-0 left-0 right-0 h-6 flex items-center justify-between px-3 text-primary-text z-10">
                  <span>
                    {rank}. {context.playerName(playerId)}
                  </span>
                  <span>{fmtNum(value)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
