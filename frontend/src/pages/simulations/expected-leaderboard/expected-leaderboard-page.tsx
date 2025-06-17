import { useEffect, useRef, useState } from "react";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { ProfilePicture } from "../../player/profile-picture";
import { fmtNum } from "../../../common/number-utils";

export const SimulatedLeaderboard: React.FC = () => {
  const context = useEventDbContext();

  const [leaderboardData] = useState(context.simulations.expectedLeaderBoard());
  const [playerPositions, setPlayerPositions] = useState<Map<string, { current: number; simulated: number }>>(
    new Map(),
  );

  const currentListRef = useRef<HTMLDivElement>(null);
  const simulatedListRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Calculate player positions for drawing lines
  useEffect(() => {
    if (currentListRef.current && simulatedListRef.current) {
      const positions = new Map<string, { current: number; simulated: number }>();

      leaderboardData.current.forEach((player, index) => {
        const currentElement = currentListRef.current?.children[index] as HTMLElement;
        const simulatedPlayer = leaderboardData.expected.find((p) => p.id === player.id);
        const simulatedIndex = leaderboardData.expected.findIndex((p) => p.id === player.id);
        const simulatedElement = simulatedListRef.current?.children[simulatedIndex] as HTMLElement;

        if (currentElement && simulatedElement && simulatedPlayer) {
          const currentRect = currentElement.getBoundingClientRect();
          const simulatedRect = simulatedElement.getBoundingClientRect();
          const containerRect = currentListRef.current!.parentElement!.getBoundingClientRect();

          positions.set(player.id, {
            current: currentRect.top + currentRect.height / 2 - containerRect.top,
            simulated: simulatedRect.top + simulatedRect.height / 2 - containerRect.top,
          });
        }
      });

      setPlayerPositions(positions);
    }
  }, [leaderboardData]);

  const getRankChange = (playerId: string): number => {
    const currentPlayer = leaderboardData.current.find((p) => p.id === playerId);
    const simulatedPlayer = leaderboardData.expected.find((p) => p.id === playerId);

    if (currentPlayer && simulatedPlayer) {
      return currentPlayer.rank - simulatedPlayer.rank; // Positive = moved up, Negative = moved down
    }
    return 0;
  };

  const getScoreChange = (playerId: string): number => {
    const currentPlayer = leaderboardData.current.find((p) => p.id === playerId);
    const simulatedPlayer = leaderboardData.expected.find((p) => p.id === playerId);

    if (currentPlayer && simulatedPlayer) {
      return simulatedPlayer.score - currentPlayer.score;
    }
    return 0;
  };

  const getLineColor = (change: number): string => {
    if (change > 0) return "#10b981"; // green
    if (change < 0) return "#ef4444"; // red
    return "#6b7280"; // gray
  };

  const PlayerCard: React.FC<{
    player: { id: string; rank: number; score: number };
    type: "current" | "simulated";
    showChanges?: boolean;
  }> = ({ player, type, showChanges = false }) => {
    const rankChange = getRankChange(player.id);
    const scoreChange = getScoreChange(player.id);

    return (
      <div
        className={`p-3 rounded-lg border transition-all duration-300 flex items-center space-x-3 ${
          type === "current"
            ? "bg-blue-50 border-blue-200 hover:border-blue-300"
            : "bg-green-50 border-green-200 hover:border-green-300"
        }`}
      >
        <ProfilePicture playerId={player.id} size={60} border={4} shape="rounded" linkToPlayer />

        {/* Rank */}
        <div className={`text-lg font-bold min-w-[2rem] ${type === "current" ? "text-blue-700" : "text-green-700"}`}>
          #{player.rank}
        </div>

        {/* Player Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 truncate">{context.playerName(player.id)}</div>
          <div className={`text-sm font-bold ${type === "current" ? "text-blue-600" : "text-green-600"}`}>
            {fmtNum(player.score)}
          </div>
        </div>

        {/* Changes */}
        {showChanges && (
          <div>
            {rankChange !== 0 && (
              <p className={`text-xs font-medium ${rankChange > 0 ? "text-green-600" : "text-red-600"}`}>
                {fmtNum(rankChange, { signedPositive: true })} rank{Math.abs(rankChange) !== 1 && "s"}
              </p>
            )}
            {scoreChange !== 0 && (
              <p className={`text-xs ${scoreChange > 0 ? "text-green-600" : "text-red-600"}`}>
                ({fmtNum(scoreChange, { signedPositive: true })} score)
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto bg-primary-background">
      {/* Comparison Visualization */}
      <div className="grid grid-cols-5 relative">
        {/* Current Leaderboard */}
        <div className="col-span-2">
          <h2 className="text-xl font-bold text-primary-text mb-4 text-center">Current Leaderboard</h2>
          <div ref={currentListRef} className="space-y-2">
            {leaderboardData.current.map((player) => (
              <PlayerCard key={`current-${player.id}`} player={player} type="current" />
            ))}
          </div>
        </div>

        {/* Connection Lines */}
        <div className="col-span-1 relative flex justify-center">
          <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {Array.from(playerPositions.entries()).map(([playerName, positions]) => {
              const rankChange = getRankChange(playerName);
              return (
                <line
                  key={`line-${playerName}`}
                  x1="0"
                  y1={positions.current}
                  x2="100%"
                  y2={positions.simulated}
                  stroke={getLineColor(rankChange)}
                  strokeWidth="5"
                />
              );
            })}
          </svg>
        </div>

        {/* Expected Leaderboard */}
        <div className="col-span-2">
          <h2 className="text-xl font-bold text-primary-text mb-4 text-center">Expected Leaderboard</h2>
          <div ref={simulatedListRef} className="space-y-2">
            {leaderboardData.expected.map((player) => (
              <PlayerCard key={`simulated-${player.id}`} player={player} type="simulated" showChanges={true} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
