import { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "./profile-picture";
import { fmtNum } from "../../common/number-utils";
import { Fraction } from "../../client/client-db/future-elo";
import { classNames } from "../../common/class-names";
import { Link } from "react-router-dom";

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
  context.futureElo.calculatePlayerFractionsForToday();

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
    <div className="space-y-2">
      <h2>Predicted win chance</h2>

      {opponents.map(([oponentId, oponent]) => {
        const isExpanded = expandedPlayers.has(oponentId);
        const fractions = [oponent.directFraction, oponent.oneLayerFraction, oponent.twoLayerFraction];
        const combined = context.futureElo.combinePrioritizedFractions(fractions);
        const winChance = combined?.fraction || 0;
        const confidence = combined?.confidence || 0;

        return (
          <div key={oponentId} className="border border-secondary-text/20 rounded-lg overflow-hidden">
            {/* Player Header - Clickable */}
            <button
              onClick={() => togglePlayer(oponentId)}
              className="w-full px-4 py-1 bg-secondary-background hover:bg-secondary-text/20 flex items-center justify-between group text-secondary-text"
            >
              <div className="flex items-center gap-2 w-full">
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
                <div className="grow" />
                <Link
                  to={`/1v1/?player1=${playerId}&player2=${oponentId}`}
                  className="text-xs text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/50 px-2 py-1 rounded-md"
                >
                  👥🥊 Compare 1v1
                </Link>
              </div>
            </button>

            {/* Player Content - Expandable */}
            {isExpanded && (
              <div className="p-4 bg-primary-background text-primary-text ">
                <div className="flex gap-4 border-l-2 border-secondary-background py-2 overflow-auto pl-6">
                  {/* Probability Breakdown */}
                  <ul className="space-y-1">
                    <li className="text-sm flex items-center gap-2 whitespace-nowrap">Indirect level analysis</li>
                    {fractions.map((fraction, index) => {
                      const hasNoConfidence = (fraction?.confidence || 0) === 0;

                      let lable = "";

                      switch (index) {
                        case 0:
                          lable = "Direct";
                          break;
                        case 1:
                          lable = "1 intermediary";
                          break;
                        case 2:
                          lable = "2 intermediaries";
                          break;
                      }

                      return (
                        <li
                          key={playerId + oponentId + index}
                          className={`text-sm flex items-center gap-2 whitespace-nowrap text-right ${
                            hasNoConfidence ? "line-through opacity-30" : ""
                          }`}
                        >
                          <span className="opacity-70 font-light italic text-primary-text w-28">{lable}:</span>
                          <span>
                            {fmtNum((fraction?.fraction || 0) * 100)}% @{fmtNum((fraction?.confidence || 0) * 100)}%
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div>
                    <p className="text-2xl">&larr;</p>
                    <p className="text-xl rotate-90">&#x21b5;</p>
                    <p className="text-xl rotate-90">&#x21b5;</p>
                  </div>
                  <ul className="space-y-1">
                    <li className="text-sm flex items-center gap-2 whitespace-nowrap">Per score level analysis</li>

                    {Array(3)
                      .fill(1)
                      .map((_, index) => {
                        let fraction: Fraction | undefined = undefined;
                        let lable = "";

                        switch (index) {
                          case 0:
                            {
                              const game = context.futureElo.getDirectGameFraction(playerId, oponentId);
                              fraction = game.fraction;
                              lable = "Games";
                            }
                            break;
                          case 1:
                            {
                              const game = context.futureElo.getDirectSetFraction(playerId, oponentId);
                              fraction = game.fraction;
                              lable = "Sets -> game";
                            }
                            break;
                          case 2:
                            {
                              const game = context.futureElo.getDirectPointFraction(playerId, oponentId);
                              fraction = game.fraction;
                              lable = "Points -> game";
                            }
                            break;
                        }
                        const hasNoConfidence = (fraction?.confidence || 0) === 0;

                        return (
                          <li
                            key={"score fractions " + playerId + oponentId + index}
                            className={classNames(
                              "text-sm flex items-center gap-2 whitespace-nowrap",
                              hasNoConfidence && "line-through opacity-30",
                            )}
                          >
                            <span className="opacity-70 font-light italic text-primary-text w-28 text-right">
                              {lable}:
                            </span>
                            <span className="w-20">
                              {fmtNum((fraction?.fraction || 0) * 100)}% @{fmtNum((fraction?.confidence || 0) * 100)}%
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                  <div className="text-2xl">&larr;</div>
                  <ul className="space-y-1 pr-6">
                    <li className="text-sm flex items-center gap-2 whitespace-nowrap">Recency bias adjusted scores</li>
                    {Array(3)
                      .fill(1)
                      .map((_, index) => {
                        let lable = "";
                        let won = 0;
                        let lost = 0;

                        switch (index) {
                          case 0:
                            {
                              const game = context.futureElo.getDirectGameFraction(playerId, oponentId);
                              won = game.weightedWins;
                              lost = game.weightedLost;
                              lable = "Games";
                            }
                            break;
                          case 1:
                            {
                              const game = context.futureElo.getDirectSetFraction(playerId, oponentId);
                              won = game.weightedWins;
                              lost = game.weightedLost;
                              lable = "Sets";
                            }
                            break;
                          case 2:
                            {
                              const game = context.futureElo.getDirectPointFraction(playerId, oponentId);
                              won = game.weightedWins;
                              lost = game.weightedLost;
                              lable = "Points";
                            }
                            break;
                        }
                        const hasNoData = !won && !lost;

                        return (
                          <li
                            key={"score fractions " + playerId + oponentId + index}
                            className={classNames(
                              "text-sm flex items-center gap-2 whitespace-nowrap",
                              hasNoData && "line-through opacity-30",
                            )}
                          >
                            <span className="opacity-70 font-light italic text-primary-text w-12 text-right">
                              {lable}:
                            </span>
                            <span className="w-8">{!!won || !!lost ? fmtNum((won / (won + lost)) * 100) : "- "}%</span>
                            {(!!won || !!lost) && (
                              <span className="ml-2 px-2 py-0.5 bg-secondary-background text-secondary-text rounded text-xs">
                                {fmtNum(won, { digits: 1 })} : {fmtNum(lost, { digits: 1 })}
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                  <div className="text-2xl">&larr;</div>
                  <ul className="space-y-1 pr-6">
                    <li className="text-sm flex items-center gap-2 whitespace-nowrap">Total scored</li>
                    {Array(3)
                      .fill(1)
                      .map((_, index) => {
                        let lable = "";
                        let won = 0;
                        let lost = 0;

                        switch (index) {
                          case 0:
                            {
                              const game = context.futureElo.getDirectGameFraction(playerId, oponentId);
                              won = game.won;
                              lost = game.lost;
                              lable = "Games";
                            }
                            break;
                          case 1:
                            {
                              const game = context.futureElo.getDirectSetFraction(playerId, oponentId);
                              won = game.won;
                              lost = game.lost;
                              lable = "Sets";
                            }
                            break;
                          case 2:
                            {
                              const game = context.futureElo.getDirectPointFraction(playerId, oponentId);
                              won = game.won;
                              lost = game.lost;
                              lable = "Points";
                            }
                            break;
                        }
                        const hasNoData = !won && !lost;

                        return (
                          <li
                            key={"score fractions " + playerId + oponentId + index}
                            className={classNames(
                              "text-sm flex items-center gap-2 whitespace-nowrap",
                              hasNoData && "line-through opacity-30",
                            )}
                          >
                            <span className="opacity-70 font-light italic text-primary-text w-12 text-right">
                              {lable}:
                            </span>
                            <span className="w-8">{!!won || !!lost ? fmtNum((won / (won + lost)) * 100) : "- "}%</span>
                            {(!!won || !!lost) && (
                              <span className="ml-2 px-2 py-0.5 bg-secondary-background text-secondary-text rounded text-xs">
                                {fmtNum(won)} : {fmtNum(lost)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </div>
                <div className="text-xs pl-7 pt-4 font-light italic">
                  *Prediction win% and confidence% are all age adjusted to promote recency bias.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
