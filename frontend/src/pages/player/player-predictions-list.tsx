import { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "./profile-picture";
import { fmtNum } from "../../common/number-utils";
import { Link } from "react-router-dom";
import { PredictionExplanation } from "./prediction-explanation";

type Props = {
  playerId: string;
};

export const PlayerPredictionsList = ({ playerId }: Props) => {
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const togglePlayer = (playerName: string) => {
    setExpandedPlayers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(playerName)) {
        newSet.delete(playerName);
      } else {
        newSet.add(playerName);
      }
      return newSet;
    });
  };

  const context = useEventDbContext();
  const leaderboard = context.leaderboard.getLeaderboard();
  const predictions = context.predictions;

  const opponents = leaderboard.rankedPlayers.filter((r) => r.id !== playerId);

  return (
    <div className="space-y-2">
      {opponents.map((opponent) => {
        const oponentId = opponent.id;
        const isExpanded = expandedPlayers.has(oponentId);
        const predicted = predictions.getPredictedFraction(playerId, oponentId);
        const winChance = predicted?.fraction || 0;
        const confidence = predicted?.confidence || 0;

        return (
          <div key={oponentId} className="border border-secondary-text/20 rounded-lg overflow-hidden">
            {/* Player Header - Clickable */}
            <button
              onClick={() => togglePlayer(oponentId)}
              className="w-full px-4 py-1 bg-secondary-background hover:bg-secondary-text/20 flex items-center justify-between group text-secondary-text"
            >
              <div className="flex items-center gap-2 w-full">
                {isExpanded ? "▼" : "▶"}
                <div className="sm:flex items-center gap-2">
                  <ProfilePicture playerId={oponentId} border={3} size={45} shape="rounded" linkToPlayer />
                  <span className="text-md sm:text-xl font-semibold w-28 text-left">
                    {context.playerName(oponentId)}
                  </span>
                </div>
                {/* Matchup Header */}
                <div className="flex flex-wrap gap-2 items-baseline text-md">
                  <p>
                    <span className="font-bold text-md sm:text-xl">{fmtNum(winChance * 100)}% </span> win chance
                  </p>
                  <p>@{fmtNum(confidence * 100)}% confidence</p>
                </div>
                <div className="grow" />
                <Link
                  to={`/1v1/?player1=${playerId}&player2=${oponentId}`}
                  className="text-xs text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/50 px-2 py-1 rounded-md"
                >
                  👥🥊 Compare
                </Link>
              </div>
            </button>

            {/* Player Content - Expandable */}
            {isExpanded && (
              <div className="p-4 bg-primary-background text-primary-text">
                <PredictionExplanation playerId={playerId} opponentId={oponentId} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
