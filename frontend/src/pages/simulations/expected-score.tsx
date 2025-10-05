import React, { useState } from "react";
import { useRerender } from "../../hooks/use-rerender";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { ProfilePicture } from "../player/profile-picture";

export const ExpectedScore: React.FC = () => {
  const rerender = useRerender();
  const context = useEventDbContext();

  // Track which players are expanded
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // Toggle expansion for a player
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

  const playersData = Array.from(context.futureElo.playersMap.entries()).filter(
    ([_, p]) => p.totalGames >= context.client.gameLimitForRanked,
  );

  return (
    <div className="flex flex-col items-center text-primary-text bg-primary-background rounded-lg p-4 w-fit m-auto">
      <section className="w-96 mb-16 space-y-4">
        <h1 className="text-2xl">Expected score</h1>
        <p>
          Predicts future games based on players' history, then simulates that future. The result should be the expected
          score for every player if current trends contiune.
        </p>
        <p>
          It simulates {window.tennisTable.futureElo.GAMES_TO_PREDICT_PER_OPONENT} games between all possible player
          pairings of ranked players. The win/loss probability is calculated in 3 ways and combined to a weighted avrage
          weighted on confidence.
        </p>

        <div className="bg-secondary-background text-secondary-text rounded p-3 mt-3">
          <p className="font-semibold mb-2">Probability Methods:</p>
          <ul className="space-y-1 text-sm">
            <li className="flex items-start">
              <span className="text-blue-400 font-mono mr-2 min-w-[20px]">0:</span>
              <span>Direct probability from existing results between the players</span>
            </li>
            <li className="flex items-start">
              <span className="text-yellow-400 font-mono mr-2 min-w-[20px]">1:</span>
              <span>
                Chained probability with <b>one</b> intermediate player
              </span>
            </li>
            <li className="flex items-start">
              <span className="text-purple-400 font-mono mr-2 min-w-[20px]">2:</span>
              <span>
                Chained probability with <b>two</b> intermediate players
              </span>
            </li>
          </ul>
        </div>

        <p>The 3 probabilities are again combined for the final prediction.</p>

        <div className="bg-secondary-background text-secondary-text rounded p-3">
          <p className="text-sm font-semibold mb-1">EXAMPLE:</p>
          <p className="text-sm">
            <span className="text-lg font-bold text-green-400">60% @90%</span> means 60% chance to win with a 90%
            confidence in the prediction.
          </p>
        </div>
      </section>

      {context.futureElo.playersMap.size === 0 && (
        <button
          className="bg-secondary-background hover:bg-secondary-background/50 text-secondary-text rounded-lg px-10 py-2 my-2"
          onClick={async () => {
            window.tennisTable.futureElo.calculatePlayerFractions();
            rerender();
          }}
        >
          Simulate!
        </button>
      )}

      <div className="w-full max-w-4xl">
        {context.futureElo.playersMap.size > 0 ? (
          <section className="mb-6 space-y-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl">Data dump</h1>
              <span className="text-2xl">⚡</span>
            </div>
            <div className="flex items-center justify-between">
              <p>Feel free to navigate anywhere in the app to see the effects of the simulated games 😄</p>
              <span className="text-sm opacity-60">Click players to expand/collapse</span>
            </div>
          </section>
        ) : null}

        {/* Players List with Expandable Sections */}
        <div className="space-y-2">
          {playersData.map(([playerId, player]) => {
            const isExpanded = expandedPlayers.has(playerId);
            const opponents = Array.from(player.oponentsMap.entries());

            return (
              <div key={playerId} className="border border-gray-700 rounded-lg overflow-hidden">
                {/* Player Header - Clickable */}
                <button
                  onClick={() => togglePlayer(playerId)}
                  className="w-full px-4 py-1 bg-secondary-background hover:bg-gray-700 transition-colors 
                           flex items-center justify-between group text-secondary-text"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? "▼" : "▶"}
                    <ProfilePicture playerId={playerId} border={3} size={50} shape="rounded" />
                    <span className="text-xl font-semibold">{context.playerName(playerId)}</span>
                  </div>
                </button>

                {/* Player Content - Expandable */}
                {isExpanded && (
                  <div className="p-4 bg-primary-background space-y-3">
                    {opponents.map(([oponent, results]) => {
                      const fractions = [results.directFraction, results.oneLayerFraction, results.twoLayerFraction];
                      const combined = context.futureElo.combinePrioritizedFractions(fractions);
                      const winChance = combined?.fraction || 0;
                      const confidence = combined?.confidence || 0;

                      return (
                        <div key={playerId + oponent} className="border-l-2 border-gray-600 pl-4 py-2">
                          {/* Matchup Header */}
                          <div className="flex flex-wrap items-baseline gap-2 mb-2">
                            <span className="font-medium">{context.playerName(playerId)}</span>
                            <span className="text-gray-500">→</span>
                            <span className="font-medium">{context.playerName(oponent)}</span>
                            <span className={`text-lg font-bold `}>{fmtNum(winChance * 100)}%</span>
                            <span className="text-sm">win chance</span>
                            <span className={`text-sm `}>@{fmtNum(confidence * 100)}% confidence</span>
                          </div>

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
                                    {fmtNum((fraction?.fraction || 0) * 100)}% @
                                    {fmtNum((fraction?.confidence || 0) * 100)}%
                                  </span>
                                  {index === 0 && results.wins && results.loss && (
                                    <span className="ml-2 px-2 py-0.5 bg-gray-700 rounded text-xs">
                                      {results.wins.length}:{results.loss.length}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
