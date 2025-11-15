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

export const TournamentPredictions = ({ tournament }: { tournament: Tournament }) => {
  const [range, setRange] = useState(0);

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
    return simulationTimes.map((time) => {
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

  useEffect(() => {
    setGraphDataToSee(graphData.slice(Math.max(range - 2, 0)) || []);
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
      <section className="flex flex-col items-center bg-primary-background rounded-lg p-4 w-full max-w-[1050px]">
        {/* Simulate Button */}
        {predictionResults.length === 0 && (
          <>
            <button
              onClick={handleSimulate}
              className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Run Simulation
            </button>
            <p>*May take up to 10 seconds to see result</p>
          </>
        )}

        {/* Progress Bar */}
        {simulationTimes.length > 0 && !simulationIsDone && (
          <div className="w-full max-w-[1000px] mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-primary-text">Simulation Progress</span>
              <span className="text-sm text-primary-text">{Math.round(simulationProgress * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${simulationProgress * 100}%` }}
              ></div>
            </div>
          </div>
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
            <LineChart
              className="mt-2"
              width={Math.min(1000, width - 50)}
              height={Math.min(500, Math.max(300, height - 200))}
              margin={{ left: 10, right: 10 }}
              data={graphDataToSee}
            >
              <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" />
              <XAxis dataKey="name" stroke="rgb(var(--color-primary-text))" />
              <YAxis
                type="number"
                domain={[0, 100]}
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
          ) : (
            <div className="w-full h-[428px] rounded-lg bg-gray-300/50 flex items-center justify-center text-primary-text">
              Click 'Run Simulation' to view predictions
            </div>
          )}
        </div>
      </section>
    </div>
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
