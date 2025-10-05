import { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "./profile-picture";
import { fmtNum } from "../../common/number-utils";

type Props = {
  playerId: string;
};

export const PlayerPredictions: React.FC<Props> = ({ playerId }) => {
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
  context.futureElo.calculatePlayerFractions();

  const leaderboard = context.leaderboard.getLeaderboard();

  const playersData = context.futureElo.playersMap.get(playerId)!;

  const opponents = Array.from(playersData.oponentsMap.entries())
    .filter((o) => leaderboard.rankedPlayers.find((r) => r.id === o[0]))
    .sort((a, b) => {
      const aRankedIndex = leaderboard.rankedPlayers.findIndex((r) => r.id === a[0]);
      const bRankedIndex = leaderboard.rankedPlayers.findIndex((r) => r.id === b[0]);
      return (
        (leaderboard.rankedPlayers[aRankedIndex]?.rank || Infinity) -
        (leaderboard.rankedPlayers[bRankedIndex]?.rank || Infinity)
      );
    });

  return (
    <div className="">
      <h2>Predicted win chance</h2>

      {opponents.map(([oponentId, oponent]) => {
        const isExpanded = expandedPlayers.has(oponentId);
        const fractions = [oponent.directFraction, oponent.oneLayerFraction, oponent.twoLayerFraction];
        const combined = context.futureElo.combinePrioritizedFractions(fractions);
        const winChance = combined?.fraction || 0;
        const confidence = combined?.confidence || 0;

        return (
          <div key={oponentId} className="border border-gray-700 rounded-lg overflow-hidden">
            {/* Player Header - Clickable */}
            <button
              onClick={() => togglePlayer(oponentId)}
              className="w-full px-4 py-1 bg-secondary-background hover:bg-gray-700 transition-colors 
                                   flex items-center justify-between group text-secondary-text"
            >
              <div className="flex items-center gap-2">
                {isExpanded ? "▼" : "▶"}
                <ProfilePicture playerId={oponentId} border={3} size={50} shape="rounded" linkToPlayer />
                <span className="text-xl font-semibold w-28 text-left">{context.playerName(oponentId)}</span>
                {/* Matchup Header */}
                <div className="flex flex-wrap gap-2 items-baseline">
                  <p>
                    <span className="font-bold text-xl">{fmtNum(winChance * 100)}% </span> win chance
                  </p>
                  <p>@{fmtNum(confidence * 100)}% confidence</p>
                </div>
              </div>
            </button>

            {/* Player Content - Expandable */}
            {isExpanded && (
              <div className="p-4 bg-primary-background space-y-3">
                <div key={playerId + oponent} className="border-l-2 border-gray-600 pl-4 py-2">
                  {/* Probability Breakdown */}
                  <ul className="ml-6 space-y-1">
                    {fractions.map((fraction, index) => {
                      if (!fraction) return null;
                      const hasNoConfidence = (fraction?.confidence || 0) === 0;

                      return (
                        <li
                          key={playerId + oponent + index}
                          className={`text-sm flex items-center gap-2 ${
                            hasNoConfidence ? "line-through opacity-30" : ""
                          }`}
                        >
                          <span className={`opacity-70 font-light italic`}>{index}:</span>
                          <span>
                            {fmtNum((fraction?.fraction || 0) * 100)}% @{fmtNum((fraction?.confidence || 0) * 100)}%
                          </span>
                          {index === 0 && oponent.wins && oponent.loss && (
                            <span className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs">
                              {oponent.wins.length}:{oponent.loss.length}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
