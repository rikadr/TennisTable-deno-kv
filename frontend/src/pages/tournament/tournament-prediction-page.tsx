import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { useWindowSize } from "usehooks-ts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { stringToColor } from "../../common/string-to-color";
import { relativeTimeString } from "../../common/date-utils";

export const TournamentPredictionPage: React.FC = () => {
  const context = useEventDbContext();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [range, setRange] = useState(0);
  const [shouldSimulate, setShouldSimulate] = useState(false);

  const allTournaments = useMemo(
    () => context.tournaments.getTournaments().filter((t) => t.tournamentDb.skippedGames.length === 0),
    [context.tournaments],
  );

  const prediction = useMemo(() => {
    if (!selectedTournamentId || !shouldSimulate) return null;
    setRange(0);
    return context.tournaments.tournamentPrediction.predictTournament(selectedTournamentId);
  }, [context, selectedTournamentId, shouldSimulate]);

  const graphData = useMemo(() => {
    if (!prediction) return [];

    // Get NUM_SIMULATIONS from the first entry (total wins should sum to this)
    const numSimulations = prediction[0]?.players
      ? Array.from(prediction[0].players.values()).reduce((sum, p) => sum + p.wins, 0)
      : 1000;

    // Transform prediction results into graph data
    return prediction.map((result) => {
      const dataPoint: Record<string, number | string> = {
        time: result.time,
        name: new Date(result.time).toLocaleDateString("no-NO", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        confidence: result.confidence * 100, // Convert to percentage
      };

      // Convert each player's wins to percentage
      result.players.forEach((playerData, playerId) => {
        dataPoint[playerId] = (playerData.wins / numSimulations) * 100;
      });

      return dataPoint;
    });
  }, [prediction]);

  const [graphDataToSee, setGraphDataToSee] = useState<Record<string, number | string>[]>(graphData);

  const { width = 0, height = 0 } = useWindowSize();

  useEffect(() => {
    setGraphDataToSee(graphData.slice(Math.max(range - 2, 0)) || []);
  }, [graphData, range]);

  // Get all unique player IDs from the data
  const allPlayers = useMemo(() => {
    if (!prediction || prediction.length === 0) return [];
    const playerSet = new Set<string>();
    prediction.forEach((result) => {
      result.players.forEach((_, playerId) => {
        playerSet.add(playerId);
      });
    });
    return Array.from(playerSet);
  }, [prediction]);

  const handleSimulate = () => {
    setShouldSimulate(true);
  };

  const handleTournamentChange = (tournamentId: string) => {
    setSelectedTournamentId(tournamentId);
    setShouldSimulate(false); // Reset simulation when tournament changes
  };

  return (
    <div className="flex flex-col items-center">
      <section className="flex flex-col items-center bg-primary-background rounded-lg p-4 w-full max-w-[1050px]">
        {/* Tournament Selector */}
        <div className="w-full mb-4">
          <label htmlFor="tournament-select" className="block text-primary-text mb-2 font-medium">
            Select Tournament:
          </label>
          <select
            id="tournament-select"
            value={selectedTournamentId}
            onChange={(e) => handleTournamentChange(e.target.value)}
            className="w-full h-10 px-4 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-text"
          >
            <option value="">-- Select a tournament --</option>
            {allTournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>
                {tournament.name || tournament.id}
              </option>
            ))}
          </select>
        </div>

        {/* Simulate Button */}
        {selectedTournamentId && !shouldSimulate && (
          <button
            onClick={handleSimulate}
            className="mb-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Run Simulation
          </button>
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
          ) : selectedTournamentId && shouldSimulate ? (
            <div className="w-full h-[428px] rounded-lg bg-gray-300/50 animate-pulse" />
          ) : (
            <div className="w-full h-[428px] rounded-lg bg-gray-300/50 flex items-center justify-center text-primary-text">
              {selectedTournamentId
                ? "Click 'Run Simulation' to view predictions"
                : "Select a tournament to view predictions"}
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
        {playerEntries.map((entry) => (
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
