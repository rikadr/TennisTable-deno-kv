import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { useWindowSize } from "usehooks-ts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { stringToColor } from "../../common/string-to-color";
import { relativeTimeString } from "../../common/date-utils";
import { NUM_SIMULATIONS } from "../../client/client-db/tournaments/prediction";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useTournamentPredictionWorker } from "../../hooks/use-tournament-prediction-worker";
import { ProgressBar } from "../player/player-elo-graph";

const ZOOM_STEP = 20; // 20% per click
const MIN_Y_MAX = 20; // Don't zoom in past 20%
const DEFAULT_Y_MAX = 100;

export const TournamentPredictions = ({ tournament }: { tournament: Tournament }) => {
  const [range, setRange] = useState(2);
  const [yMax, setYMax] = useState(DEFAULT_Y_MAX);

  const { startSimulation, simulationTimes, predictionResults, simulationIsDone, simulationProgress } =
    useTournamentPredictionWorker();

  const graphData = useMemo(() => {
    if (simulationTimes.length === 0) return [];

    // First, collect all unique player IDs across all prediction results
    const allPlayerIds = new Set<string>();
    predictionResults.forEach((result) => {
      Object.keys(result.players).forEach((playerId) => {
        allPlayerIds.add(playerId);
      });
    });

    // Create a map of time -> result for quick lookup
    const resultsByTime = new Map(predictionResults.map((result) => [result.time, result]));

    // Transform prediction results into graph data
    // Since results come reversed (most recent first), reverse simulationTimes to get chronological order
    const chronologicalTimes = [...simulationTimes].reverse();

    return chronologicalTimes.map((time) => {
      const result = resultsByTime.get(time);

      const dataPoint: Record<string, number | string> = {
        time: time,
        name: new Date(time).toLocaleDateString("no-NO", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        confidence: result ? result.confidence * 100 : 0, // Convert to percentage
      };

      // Initialize all players to 0
      allPlayerIds.forEach((playerId) => {
        dataPoint[playerId] = 0;
      });

      // If we have data for this time, fill in the player percentages
      if (result) {
        Object.keys(result.players).forEach((playerId) => {
          dataPoint[playerId] = (result.players[playerId].wins / NUM_SIMULATIONS) * 100;
        });
      }

      return dataPoint;
    });
  }, [simulationTimes, predictionResults]);

  const [graphDataToSee, setGraphDataToSee] = useState<Record<string, number | string>[]>(graphData);

  const { width = 0, height = 0 } = useWindowSize();

  // Auto-update range as new data comes in
  useEffect(() => {
    if (graphData.length > 0) {
      setRange(graphData.length);
    }
  }, [graphData.length]);

  useEffect(() => {
    // Slice from the beginning up to the range value to show data filling from left to right
    setGraphDataToSee(graphData.slice(0, range) || []);
  }, [graphData, range]);

  // Get all unique player IDs from the data
  const allPlayers = useMemo(() => {
    if (predictionResults.length === 0) return [];
    const playerSet = new Set<string>();
    predictionResults.forEach((result) => {
      Object.keys(result.players).forEach((playerId) => {
        playerSet.add(playerId);
      });
    });
    return Array.from(playerSet);
  }, [predictionResults]);

  const handleSimulate = () => {
    startSimulation(tournament.id);
  };

  return (
    <div className="flex flex-col items-center">
      <section className="flex flex-col items-center bg-primary-background rounded-lg w-full max-w-[1050px]">
        {/* Simulate Button */}
        {predictionResults.length === 0 && (
          <>
            <button
              onClick={handleSimulate}
              className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Run Simulation
            </button>
          </>
        )}

        {/* Graph Controls and Display */}
        <div className="w-full">
          {graphData.length > 0 && (
            <input
              className="w-full mb-2"
              type="range"
              min="2"
              max={graphData.length || 0}
              value={range}
              onChange={(e) => setRange(parseInt(e.target.value))}
            />
          )}
          {graphData.length > 0 ? (
            <>
            <div className="flex items-center gap-2 mb-2 justify-end pr-2 md:pr-4">
              <span className="text-primary-text/70 text-xs md:text-sm">Y-axis: {yMax}%</span>
              <button
                onClick={() => setYMax((prev) => Math.min(DEFAULT_Y_MAX, prev + ZOOM_STEP))}
                disabled={yMax >= DEFAULT_Y_MAX}
                className="px-2 md:px-3 py-1 bg-secondary-background/60 hover:bg-secondary-background/80 disabled:opacity-30 disabled:cursor-not-allowed text-secondary-text font-bold rounded transition-colors text-base md:text-lg leading-none"
              >
                &minus;
              </button>
              <button
                onClick={() => setYMax((prev) => Math.max(MIN_Y_MAX, prev - ZOOM_STEP))}
                disabled={yMax <= MIN_Y_MAX}
                className="px-2 md:px-3 py-1 bg-secondary-background/60 hover:bg-secondary-background/80 disabled:opacity-30 disabled:cursor-not-allowed text-secondary-text font-bold rounded transition-colors text-base md:text-lg leading-none"
              >
                +
              </button>
            </div>
            <LineChart
              className="mt-2"
              width={Math.min(1000, width - 50)}
              height={Math.min(500, Math.max(300, height - 200))}
              data={graphDataToSee}
            >
              <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" />
              <XAxis dataKey="name" stroke="rgb(var(--color-primary-text))" />
              <YAxis
                type="number"
                domain={[0, yMax]}
                tickFormatter={(value) => `${value}%`}
                stroke="rgb(var(--color-primary-text))"
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Win Probability"]}
                wrapperClassName="rounded-lg"
                animationDuration={0}
                content={<CustomTooltip />}
              />
              {allPlayers.map((playerId) => (
                <Line
                  key={playerId + "color"}
                  type="monotone"
                  dataKey={playerId}
                  stroke={stringToColor(playerId)}
                  dot={false}
                  animationDuration={150}
                  strokeWidth={3}
                />
              ))}
              {allPlayers.map((playerId) => (
                <Line
                  key={playerId + "main"}
                  type="monotone"
                  dataKey={playerId}
                  stroke={"white"}
                  dot={false}
                  animationDuration={150}
                  strokeWidth={0.5}
                  opacity={0.5}
                />
              ))}
              <Line
                key="confidence"
                type="monotone"
                dataKey="confidence"
                stroke="rgb(255, 165, 0)"
                strokeDasharray="5 5"
                dot={false}
                animationDuration={150}
                strokeWidth={2}
                opacity={0.7}
              />
              <ReferenceLine
                y={50}
                label={{ value: "50%", position: "insideBottom", fill: "rgb(var(--color-primary-text))" }}
                stroke="rgb(var(--color-primary-text))"
                strokeDasharray="3 3"
              />
            </LineChart>
            </>
          ) : (
            <div className="w-full h-[428px] rounded-lg bg-gray-300/50 flex items-center justify-center text-primary-text">
              Click 'Run Simulation' to view predictions
            </div>
          )}
          {!simulationIsDone && simulationProgress > 0 && <ProgressBar progress={simulationProgress} />}
        </div>
      </section>
      {predictionResults.length > 0 && (
        <LatestPredictionTable predictionResults={predictionResults} />
      )}
    </div>
  );
};

const LatestPredictionTable = ({
  predictionResults,
}: {
  predictionResults: { time: number; players: Record<string, { wins: number }>; confidence: number }[];
}) => {
  const context = useEventDbContext();

  // The latest prediction is the first result (results come reversed, most recent first)
  const latest = predictionResults[predictionResults.length - 1];
  if (!latest) return null;

  const entries = Object.entries(latest.players)
    .map(([playerId, { wins }]) => ({
      playerId,
      name: context.playerName(playerId),
      winPct: (wins / NUM_SIMULATIONS) * 100,
    }))
    .sort((a, b) => b.winPct - a.winPct);

  return (
    <section className="w-full max-w-[1050px] mt-4 bg-primary-background rounded-lg p-2 md:p-4">
      <h3 className="text-primary-text font-semibold mb-2 text-sm md:text-base">
        Latest Prediction ({new Date(latest.time).toLocaleDateString("no-NO", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })})
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-0 text-primary-text">
          <thead>
            <tr className="border-b border-secondary-background/50">
              <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">#</th>
              <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">Player</th>
              <th className="text-right py-1 px-1 md:px-2 text-xs md:text-sm">Win %</th>
              <th className="text-left py-1 px-1 md:px-2 w-1/3 md:w-1/2"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => (
              <tr key={entry.playerId} className="border-b border-secondary-background/20">
                <td className="py-1 px-1 md:px-2 text-xs md:text-sm text-primary-text/70">{i + 1}</td>
                <td className="py-1 px-1 md:px-2 whitespace-nowrap text-xs md:text-sm truncate max-w-[120px] md:max-w-none" style={{ color: stringToColor(entry.playerId) }}>
                  {entry.name}
                </td>
                <td className="py-1 px-1 md:px-2 text-right font-mono text-xs md:text-sm">{entry.winPct.toFixed(1)}%</td>
                <td className="py-1 px-1 md:px-2">
                  <div className="w-full bg-secondary-background/30 rounded-full h-2 md:h-3">
                    <div
                      className="h-2 md:h-3 rounded-full transition-all"
                      style={{
                        width: `${entry.winPct}%`,
                        backgroundColor: stringToColor(entry.playerId),
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs md:text-sm text-primary-text/50 mt-2">
        Confidence: {(latest.confidence * 100).toFixed(1)}% &middot; {NUM_SIMULATIONS.toLocaleString()} simulations
      </p>
    </section>
  );
};

const CustomTooltip: React.FC = ({ active, payload }: TooltipProps<ValueType, NameType>) => {
  const context = useEventDbContext();

  if (active && payload && payload.length) {
    const record = payload[0].payload as Record<string, number | string>;
    const entries = Object.entries(record);

    // Sort by win percentage (descending)
    const playerEntries = entries.filter((e) => e[0] !== "time" && e[0] !== "name" && e[0] !== "confidence");
    playerEntries.sort((a, b) => (b[1] as number) - (a[1] as number));

    const gameTime = entries.find((e) => e[0] === "time");
    const confidence = entries.find((e) => e[0] === "confidence");

    return (
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg">
        {playerEntries
          .filter((e) => (e[1] as number) > 0)
          .map((entry) => (
            <p key={entry[0]} style={{ color: stringToColor(entry[0]) }}>
              {`${context.playerName(entry[0])}: ${(entry[1] as number).toFixed(1)}%`}
            </p>
          ))}
        {confidence && typeof confidence[1] === "number" && (
          <p className="text-orange-400 mt-3">{`Confidence: ${(confidence[1] as number).toFixed(1)}%`}</p>
        )}
        {gameTime && typeof gameTime[1] === "number" && gameTime[1] > 0 && (
          <p className="text-primary-text">{relativeTimeString(new Date(gameTime[1]))}</p>
        )}
      </div>
    );
  }

  return null;
};
