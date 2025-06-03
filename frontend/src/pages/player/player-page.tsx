import { useState } from "react";
import { fmtNum } from "../../common/number-utils";
import { Shimmer } from "../../common/shimmer";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ThemedPlaceNumber } from "../leaderboard/themed-place-number";
import { ProfilePicture } from "./profile-picture";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PlayerEloGraph } from "./player-elo-graph";
import { PlayerPointsDistrubution } from "./player-points-distribution";
import { PlayerGamesDistrubution } from "./player-games-distribution";
import { relativeTimeString } from "../../common/date-utils";

type TabType = "overview" | "matches" | "statistics" | "numbered-points";
const tabs = [
  { id: "overview" as TabType, label: "Overview" },
  { id: "matches" as TabType, label: "Recent Matches" },
  { id: "statistics" as TabType, label: "Statistics" },
  //   { id: "numbered-points" as TabType, label: "Numbered Points" },
];

export const PlayerPage: React.FC = () => {
  const { name: playerId } = useParams();
  const context = useEventDbContext();
  const navigate = useNavigate();

  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  const leaderboard = context.leaderboard.getLeaderboard();
  const playerInLeaderBoard = leaderboard.rankedPlayers.find((p) => p.id === playerId);
  const pendingGames = context.tournaments.findAllPendingGamesByPlayer(playerId);

  const [activeTab, setActiveTab] = useState<TabType>("overview");

  return (
    <div className="max-w-7xl mx-auto px-1 md:px-4">
      <div className="bg-secondary-background text-secondary-text rounded-t-2xl shadow-sm px-6 md:px-8 py-4">
        <div className="flex gap-4">
          <div className="relative">
            <ProfilePicture playerId={playerId} border={8} size={150} shape="rounded" clickToEdit />
            {summary.isRanked && (
              <div className="absolute -bottom-1 -right-1">
                <Shimmer className="rounded-full" enabled={!!summary.rank && summary.rank <= 10}>
                  <ThemedPlaceNumber place={summary.rank} size="xs" />
                </Shimmer>
              </div>
            )}
          </div>

          {/* Player Info */}
          <div className="flex-1 flex flex-col gap-2 text-secondary-text sm:flex-row sm:justify-between">
            <div>
              <h1 className="text-3xl xs:text-4xl sm:text-5xl font-bold mb-1">{context.playerName(playerId)}</h1>
              {summary.isRanked ? (
                <div className="text-base">
                  🏆 Rank {fmtNum(summary.rank)} of {fmtNum(leaderboard.rankedPlayers.length)}
                </div>
              ) : (
                <div className="text-base">
                  <p>Not yet ranked.</p>
                  <p>
                    <span className="font-bold">
                      {fmtNum(summary.games.length)} of {fmtNum(context.client.gameLimitForRanked)}
                    </span>{" "}
                    required games played.
                  </p>
                </div>
              )}
            </div>
            <p className="text-2xl md:text-3xl font-bold">
              {fmtNum(summary.elo)} <span className="text-base font-light">points</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-secondary-background text-tertiary-text px-6 md:px-8">
        <div className="flex space-x-2">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                    flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? "text-secondary-text border-secondary-text"
                        : "text-secondary-text/50 border-transparent hover:text-secondary-text hover:border-secondary-text border-dotted"
                    }
                  `}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-secondary-background rounded-b-2xl shadow-sm p-2 sm:p-4 md:p-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-2 sm:space-y-6">
            {/* Pending tournament games */}
            {pendingGames.length > 0 && (
              <div className="bg-tertiary-background text-tertiary-text rounded-xl p-6 pt-3">
                <h3 className="text-lg font-semibold mb-4">Pending tournament games</h3>
                {pendingGames.map((tournament) => (
                  <div key={tournament.tournament.id} className="space-y-2 p-2">
                    <Link to={`/tournament?tournament=${tournament.tournament.id}`}>
                      <h3>{tournament.tournament.name}</h3>
                    </Link>
                    {tournament.games.map((game) => (
                      <Link
                        key={tournament.tournament.id + playerId + game.oponent}
                        to={`/tournament?tournament=${tournament.tournament.id}&player1=${game.player1}&player2=${game.player2}`}
                      >
                        <div className="relative w-full max-w-96 px-4 py-2 mt-2 rounded-lg flex items-center gap-x-4 h-12 hover:bg-secondary-background/70 bg-secondary-background ring-2 ring-secondary-text text-secondary-text">
                          <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
                          <div className="flex gap-3 items-center justify-center">
                            <ProfilePicture
                              playerId={playerId}
                              size={35}
                              shape="circle"
                              clickToEdit={false}
                              border={3}
                            />
                            <h3>{context.playerName(playerId)}</h3>
                          </div>
                          <div className="grow" />
                          <div className="flex gap-3 items-center justify-center">
                            <h3>{context.playerName(game.oponent)}</h3>

                            <ProfilePicture
                              playerId={game.oponent}
                              size={35}
                              shape="circle"
                              clickToEdit={false}
                              border={3}
                            />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Score Timeline */}
            <ContentCard title="Score Timeline">
              {playerId && summary.games.length > 0 && (
                <div className="bg-primary-background rounded-lg -mx-2">
                  <PlayerEloGraph playerId={playerId} />
                  <div className="m-auto w-fit"></div>
                </div>
              )}
            </ContentCard>

            {/* Quick Stats */}
            {playerInLeaderBoard && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 text-primary-text">
                <div className="bg-primary-background rounded-lg p-4">
                  <p className="text-sm  mb-1">Win Rate (Ratio)</p>

                  <p className="text-2xl font-bold">
                    {fmtNum(100 * (playerInLeaderBoard.wins / (playerInLeaderBoard.wins + playerInLeaderBoard.loss)))}%
                  </p>
                </div>
                <div className="bg-primary-background rounded-lg p-4">
                  <p className="text-sm  mb-1">Win / Loss Ratio</p>
                  <p className="text-2xl font-bold">
                    {fmtNum(playerInLeaderBoard.wins / playerInLeaderBoard.loss, { digits: 1 })}
                  </p>
                </div>
                {summary.streaks && (
                  <>
                    <div className="bg-primary-background rounded-lg p-4">
                      <p className="text-sm  mb-1">Longest Win Streak</p>
                      <p className="text-2xl font-bold">
                        🏆🔥 {fmtNum(summary.streaks.longestWin)}{" "}
                        <span className="text-lg font-normal">game{summary.streaks.longestWin > 1 && "s"}</span>
                      </p>
                    </div>
                    <div className="bg-primary-background rounded-lg p-4">
                      <p className="text-sm  mb-1">Longest Lose Streak</p>
                      <p className="text-2xl font-bold">
                        💔🔥 {fmtNum(summary.streaks.longestLose)}{" "}
                        <span className="text-lg font-normal">game{summary.streaks.longestLose > 1 && "s"}</span>
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recent Matches Tab */}
        {activeTab === "matches" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[550px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium  text-sm">Opponent</th>
                  <th className="text-left py-3 px-1 font-medium  text-sm">Result</th>
                  <th className="text-left py-3 px-4 font-medium  text-sm">Score</th>
                  <th className="text-left py-3 px-1 font-medium  text-sm">Points</th>
                  <th className="text-left py-3 px-4 font-medium  text-sm">Time</th>
                  <th className="text-left py-3 px-4 font-medium  text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {summary.games
                  .toReversed()
                  .slice(0, 10)
                  .map((game) => (
                    <tr
                      key={game.time}
                      className="bg-secondary-background border-b border-secondary-text hover:brightness-110 transition-colors"
                    >
                      <td className="p-1">
                        <Link to={"/player/" + game.oponent}>
                          <span className="font-medium">{context.playerName(game.oponent)}</span>
                        </Link>
                      </td>
                      <td className="p-1">
                        <span className="text-2xl">{game.result === "win" ? "🏆" : "💔"}</span>
                      </td>
                      <td className="p-1 md:flex items-baseline gap-3">
                        {game.score && (
                          <div className="font-medium">
                            {game.result === "win"
                              ? `${game.score?.setsWon.gameWinner} - ${game.score?.setsWon.gameLoser}`
                              : `${game.score?.setsWon.gameLoser} - ${game.score?.setsWon.gameWinner}`}
                          </div>
                        )}
                        {game.score?.setPoints && (
                          <div className="font-light italic text-xs">
                            {game.result === "win"
                              ? game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")
                              : game.score.setPoints.map((set) => `${set.gameLoser}-${set.gameWinner}`).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="p-1">
                        <span className="font-medium flex items-center gap-1">
                          {game.result === "win" ? "+" : ""}
                          {fmtNum(game.pointsDiff)}
                        </span>
                      </td>
                      <td className="p-1">
                        <span className="text-secondary-text text-sm">{relativeTimeString(new Date(game.time))}</span>
                      </td>
                      <td className="p-1">
                        {Date.now() - game.time < 7 * 24 * 60 * 60 * 1000 && (
                          <button
                            className="text-xs text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/50 px-2 py-1 rounded-md"
                            onClick={() =>
                              navigate(
                                `/game/edit/score?gameId=${context.games.find((g) => g.playedAt === game.time)?.id}`,
                              )
                            }
                          >
                            Edit Score
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <h1>...</h1>
          </div>
        )}

        {activeTab === "statistics" && (
          <div className="space-y-6">
            <div className="grid grid-flow-row lg:grid-flow-col gap-6">
              {/* Win/Loss Points */}
              {playerId && (
                <ContentCard title="Points Exchange" description="Net points gained/lost to your opponents">
                  <PlayerPointsDistrubution playerId={playerId} />
                </ContentCard>
              )}

              {/* Games Played */}
              {playerId && (
                <ContentCard title="Games Frequency" description="Relative frequency of opponents you play">
                  <PlayerGamesDistrubution playerId={playerId} />
                </ContentCard>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContentCard: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="bg-primary-background text-primary-text rounded-xl p-6 pt-3">
      <section className="flex flex-col gap-x-6 md:flex-row items-baseline mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="">{description}</p>
      </section>
      {children}
    </div>
  );
};
