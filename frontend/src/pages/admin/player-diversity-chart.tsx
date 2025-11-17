import React, { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  ReferenceLine,
} from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";

interface WeeklyData {
  week: string;
  actualDiversity: number;
  possibleDiversity: number;
  coveragePercentage: number;
  timestamp: number;
}

export const PlayerDiversityChart: React.FC = () => {
  const context = useEventDbContext();

  const { weeklyData, tournamentsInRange } = useMemo(() => {
    if (context.games.length === 0) {
      return { weeklyData: [], tournamentsInRange: [] };
    }

    // Build player activation timeline
    const playerEvents = context.events
      .filter(
        (event) =>
          event.type === "PLAYER_CREATED" || event.type === "PLAYER_DEACTIVATED" || event.type === "PLAYER_REACTIVATED",
      )
      .sort((a, b) => a.time - b.time);

    // Helper function to get active players at a specific time
    const getActivePlayersAtTime = (timestamp: number): Set<string> => {
      const activePlayers = new Set<string>();

      for (const event of playerEvents) {
        if (event.time > timestamp) break;

        if (event.type === "PLAYER_CREATED") {
          activePlayers.add(event.stream);
        } else if (event.type === "PLAYER_DEACTIVATED") {
          activePlayers.delete(event.stream);
        } else if (event.type === "PLAYER_REACTIVATED") {
          activePlayers.add(event.stream);
        }
      }

      return activePlayers;
    };

    // Find the date range
    const minTimestamp = context.games[0].playedAt;
    const maxTimestamp = context.games[context.games.length - 1].playedAt;

    // Generate all weeks in the range
    const allWeeksData: WeeklyData[] = [];
    const startDate = new Date(minTimestamp);

    // Set to the start of the week (Sunday)
    startDate.setDate(startDate.getDate() - startDate.getDay());
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(maxTimestamp);
    endDate.setDate(endDate.getDate() - endDate.getDay());
    endDate.setHours(0, 0, 0, 0);

    const currentDate = new Date(startDate);

    // Track all pairings (we'll filter by active players per week)
    const allPairings = new Set<string>();
    let gameIndex = 0;

    while (currentDate <= endDate) {
      const weekStart = currentDate.getTime();
      const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

      // Process all games up to the end of this week
      while (gameIndex < context.games.length && context.games[gameIndex].playedAt < weekEnd) {
        const game = context.games[gameIndex];

        // Add pairing (sorted alphabetically)
        const pairing = [game.winner, game.loser].sort().join("-");
        allPairings.add(pairing);

        gameIndex++;
      }

      // Get active players at the end of this week
      const activePlayers = getActivePlayersAtTime(weekEnd - 1);

      // Filter pairings to only include those where both players are active
      const activePairings = Array.from(allPairings).filter((pairing) => {
        const [player1, player2] = pairing.split("-");
        return activePlayers.has(player1) && activePlayers.has(player2);
      });

      // Calculate possible diversity: N * (N - 1) / 2 for active players only
      const playerCount = activePlayers.size;
      const possibleDiversity = playerCount > 1 ? (playerCount * (playerCount - 1)) / 2 : 0;

      // Calculate coverage percentage
      const actualDiversity = activePairings.length;
      const coveragePercentage = possibleDiversity > 0 ? (actualDiversity / possibleDiversity) * 100 : 0;

      // Create week key for display
      const weekDate = new Date(weekStart);
      const year = weekDate.getFullYear();
      const weekNumber = getWeekNumber(weekDate);
      const weekKey = `${year}-W${String(weekNumber).padStart(2, "0")}`;

      allWeeksData.push({
        week: weekKey,
        actualDiversity,
        possibleDiversity,
        coveragePercentage,
        timestamp: weekStart,
      });

      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }

    // Filter tournaments that fall within the data range
    const tournaments = context.client.tournaments;
    const tournamentsInRange = tournaments.filter((tournament) => {
      return tournament.startDate >= minTimestamp && tournament.startDate <= Date.now();
    });

    return { weeklyData: allWeeksData, tournamentsInRange };
  }, [context.games, context.events, context.client?.tournaments]);

  // Format week for display
  const formatWeek = (weekString: string): string => {
    const [year, week] = weekString.split("-W");
    return `${year} W${week}`;
  };

  // Convert tournament timestamp to week key for positioning
  const getTournamentWeekKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    // Set to the start of the week (Sunday)
    date.setDate(date.getDate() - date.getDay());
    const year = date.getFullYear();
    const weekNumber = getWeekNumber(date);
    return `${year}-W${String(weekNumber).padStart(2, "0")}`;
  };

  if (weeklyData.length === 0) {
    return (
      <div className="text-center text-primary-text p-8">
        <p>No games data available</p>
      </div>
    );
  }

  const maxValue = Math.max(...weeklyData.map((d) => Math.max(d.actualDiversity, d.possibleDiversity)));

  return (
    <div className="bg-primary-background text-primary-text rounded-lg">
      <h2 className="text-xl font-semibold text-center mb-4">Global Player Diversity Over Time</h2>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={weeklyData} margin={{ top: 20, right: 60, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-primary-text))" opacity={0.3} />

          <XAxis
            dataKey="week"
            stroke="rgb(var(--color-primary-text))"
            tickFormatter={formatWeek}
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />

          <YAxis
            yAxisId="left"
            stroke="rgb(var(--color-primary-text))"
            tickFormatter={(value) => value.toString()}
            domain={[0, maxValue]}
            label={{ value: "Pairings", angle: -90, position: "insideLeft" }}
          />

          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="rgb(var(--color-primary-text))"
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
            label={{ value: "Coverage %", angle: 90, position: "insideRight" }}
          />

          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length > 0) {
                const data = payload[0].payload as WeeklyData;

                return (
                  <div className="bg-secondary-background text-secondary-text p-3 rounded-lg shadow-lg border border-secondary-text">
                    <p className="font-semibold">{formatWeek(label as string)}</p>
                    <p className="text-green-400">{`Actual Pairings: ${data.actualDiversity}`}</p>
                    <p className="text-blue-400">{`Possible Pairings: ${data.possibleDiversity}`}</p>
                    <p className="text-purple-400">{`Coverage: ${data.coveragePercentage.toFixed(1)}%`}</p>
                  </div>
                );
              }
              return null;
            }}
          />

          <Legend verticalAlign="top" height={36} iconType="line" wrapperStyle={{ paddingBottom: "10px" }} />

          {/* Tournament Reference Lines */}
          {tournamentsInRange.map((tournament, index) => (
            <ReferenceLine
              key={`tournament-${index}`}
              yAxisId="left"
              x={getTournamentWeekKey(tournament.startDate)}
              stroke="rgb(var(--color-tertiary-background))"
              strokeDasharray="8 4"
              strokeWidth={2}
              label={{
                value: tournament.name,
                angle: -5,
                textAnchor: "end",
                position: "insideTopRight",
                offset: 10,
                style: {
                  fontSize: "12px",
                  fill: "rgb(var(--color-tertiary-background))",
                },
              }}
            />
          ))}

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="actualDiversity"
            name="Actual Pairings"
            stroke="rgb(34, 197, 94)"
            strokeWidth={3}
            dot={false}
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="possibleDiversity"
            name="Possible Pairings"
            stroke="rgb(59, 130, 246)"
            strokeWidth={3}
            dot={false}
          />

          <Line
            yAxisId="right"
            type="monotone"
            dataKey="coveragePercentage"
            name="Coverage %"
            stroke="rgb(168, 85, 247)"
            strokeWidth={3}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-center opacity-75">
        Total games: {context.games.length} | Weeks displayed: {weeklyData.length} | Current unique pairings:{" "}
        {weeklyData[weeklyData.length - 1]?.actualDiversity || 0} /{" "}
        {weeklyData[weeklyData.length - 1]?.possibleDiversity || 0} | Coverage:{" "}
        {weeklyData[weeklyData.length - 1]?.coveragePercentage.toFixed(1) || 0}% | Tournaments:{" "}
        {tournamentsInRange.length}
      </div>
    </div>
  );
};

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
