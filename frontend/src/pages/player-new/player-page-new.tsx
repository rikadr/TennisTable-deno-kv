import { useState } from "react";
import { fmtNum } from "../../common/number-utils";
import { Shimmer } from "../../common/shimmer";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ThemedPlaceNumber } from "../leaderboard/themed-place-number";
import { ProfilePicture } from "../player/profile-picture";
import { Link } from "react-router-dom";

type TabType = "overview" | "matches" | "statistics" | "numbered-points";
const tabs = [
  { id: "overview" as TabType, label: "Overview" },
  { id: "matches" as TabType, label: "Recent Matches" },
  { id: "statistics" as TabType, label: "Statistics" },
  //   { id: "numbered-points" as TabType, label: "Numbered Points" },
];

export const PlayerPageNew: React.FC = () => {
  const { playerId } = useTennisParams();
  const context = useEventDbContext();

  const summary = context.leaderboard.getPlayerSummary(playerId || "");
  const pendingGames = context.tournaments.findAllPendingGamesByPlayer(playerId);

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  return (
    <div className="max-w-7xl mx-auto px-1 md:px-4">
      <div className="bg-secondary-background text-secondary-text rounded-t-2xl shadow-sm px-6 md:px-8 py-4">
        <div className="flex md:items-center gap-4">
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
          <div className="flex-1 flex flex-col gap-4 text-secondary-text md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{context.playerName(playerId)}</h1>
              {summary.isRanked ? (
                <div className="text-base">🏆 Rank {summary.rank} of ??</div>
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
      <div className="bg-secondary-background rounded-b-2xl shadow-sm p-6 md:p-8">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
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

            {/* Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Timeline */}
              <ContentCard title="Score Timeline">
                <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
                  <span className="text-gray-500">Score graph visualization</span>
                </div>
              </ContentCard>

              {/* Win/Loss Points */}
              <ContentCard title="Points Exchange">
                <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
                  <span className="text-gray-500">Win/loss points by opponent</span>
                </div>
              </ContentCard>

              {/* Games Played */}
              <ContentCard title="Games Frequency">
                <div className="bg-gray-200 rounded-lg h-48 flex items-center justify-center">
                  <span className="text-gray-500">Games played by opponent</span>
                </div>
              </ContentCard>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Win Rate</p>
                <p className="text-2xl font-bold text-green-600">65%</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Total Games</p>
                <p className="text-2xl font-bold text-gray-900">127</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Win Streak</p>
                <p className="text-2xl font-bold text-blue-600">3</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Avg Points/Game</p>
                <p className="text-2xl font-bold text-gray-900">+8.2</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ContentCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  return (
    <div className="bg-primary-background text-primary-text rounded-xl p-6 pt-3">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
};
