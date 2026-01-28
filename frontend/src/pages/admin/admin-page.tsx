import React, { useState } from "react";
import { queryClient } from "../../common/query-client";
import { relativeTimeString } from "../../common/date-utils";
import { Users } from "./users";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { session } from "../../services/auth";
import { AllPlayerGamesDistrubution } from "./all-player-games-distribution";
import { useEventMutation } from "../../hooks/use-event-mutation";
import {
  EventTypeEnum,
  GameDeleted,
  PlayerDeactivated,
  PlayerReactivated,
} from "../../client/client-db/event-store/event-types";
import { fmtNum } from "../../common/number-utils";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GamesPerMonthChart } from "./games-per-month";
import { GamesPerWeekChart } from "./games-per-week";
import { TopGamingDays } from "./top-days";
import { GamesPerWeekdayChart } from "./games-weekdays";
import { GamesPerTimeChart } from "./hour-of-the-day";
import { LocalAdminControls } from "./local-admin-controls";
import { Events } from "./events";
import { classNames } from "../../common/class-names";
import { PlayersTab } from "./players";
import { PlayerDiversityChart } from "./player-diversity-chart";

type TabType = "stats" | "games" | "players" | "users" | "events" | "local";
const tabs: { id: TabType; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "games", label: "Games" },
  { id: "players", label: "Players" },
  { id: "users", label: "Users" },
  { id: "events", label: "Events" },
  { id: "local", label: "Local" },
];

export const AdminPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const addEventMutation = useEventMutation();

  const activeTab = (searchParams.get("tab") as TabType) || "stats";

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

  const [chartView, setChartView] = useState<"monthly" | "weekly">("monthly");
  const [currentPage, setCurrentPage] = useState(1);
  const [gamesPerPage, setGamesPerPage] = useState(50);

  function handleDeactivatePlayer(playerId: string) {
    const event: PlayerDeactivated = {
      type: EventTypeEnum.PLAYER_DEACTIVATED,
      time: Date.now(),
      stream: playerId,
      data: null,
    };

    const validateResponse = context.eventStore.playersProjector.validateDeactivatePlayer(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries });
  }

  function handleReactivatePlayer(playerId: string) {
    const event: PlayerReactivated = {
      type: EventTypeEnum.PLAYER_REACTIVATED,
      time: Date.now(),
      stream: playerId,
      data: null,
    };

    const validateResponse = context.eventStore.playersProjector.validateReactivatePlayer(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries });
  }

  function handleDeleteGame(gameId: string) {
    const event: GameDeleted = {
      type: EventTypeEnum.GAME_DELETED,
      time: Date.now(),
      stream: gameId,
      data: null,
    };

    const validateResponse = context.eventStore.gamesProjector.validateDeleteGame(event);
    if (validateResponse.valid === false) {
      console.error(validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, {
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    });
  }

  if (session.sessionData?.role !== "admin") {
    return <div>Not authorized</div>;
  }

  // Pagination calculations
  const allGames = context.eventStore.gamesProjector.games.toReversed();
  const totalGames = allGames.length;
  const totalPages = Math.ceil(totalGames / gamesPerPage);
  const startIndex = (currentPage - 1) * gamesPerPage;
  const endIndex = startIndex + gamesPerPage;
  const paginatedGames = allGames.slice(startIndex, endIndex);

  return (
    <div className="bg-primary-background text-primary-text">
      <h1>ADMIN PAGE</h1>
      {/* Tabs Navigation */}
      <div className="bg-secondary-background text-tertiary-text px-6 md:px-8">
        <div className="flex space-x-2">
          {tabs
            .filter((t) => {
              if (t.id === "local" && process.env.REACT_APP_ENV !== "local") {
                return false;
              }
              return true;
            })
            .map((tab) => {
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (
                      tab.id === "events" &&
                      window.confirm(
                        "You should not go here if you don't know what you are doing. This is only for developers.",
                      ) === false
                    ) {
                      return;
                    }
                    setActiveTab(tab.id);
                    setCurrentPage(1); // Reset to page 1 when changing tabs
                  }}
                  className={classNames(
                    "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors",
                    activeTab === tab.id
                      ? "text-secondary-text border-secondary-text"
                      : "text-secondary-text/50 border-transparent hover:text-secondary-text hover:border-secondary-text border-dotted",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
        </div>
      </div>

      {activeTab === "stats" && (
        <>
          {/* Chart View Switcher */}
          <div className="my-6">
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setChartView("monthly")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  chartView === "monthly"
                    ? "bg-secondary-background text-secondary-text"
                    : "bg-primary-background text-primary-text/75 border border-primary-text hover:bg-secondary-background hover:text-secondary-text"
                }`}
              >
                Monthly View
              </button>
              <button
                onClick={() => setChartView("weekly")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  chartView === "weekly"
                    ? "bg-secondary-background text-secondary-text"
                    : "bg-primary-background text-primary-text/75 border border-primary-text hover:bg-secondary-background hover:text-secondary-text"
                }`}
              >
                Weekly View
              </button>
            </div>
          </div>

          {/* Chart Display */}
          {chartView === "monthly" ? <GamesPerMonthChart /> : <GamesPerWeekChart />}

          <GamesPerWeekdayChart />
          <GamesPerTimeChart />
          <TopGamingDays />
          <PlayerDiversityChart />
          <h2>Total distribution of games played</h2>
          <AllPlayerGamesDistrubution />
        </>
      )}

      {activeTab === "games" && (
        <>
          <p className="text-sm md:text-base">Games: {totalGames}</p>
          <p className="text-xs md:text-sm">
            Deleting games is not permanent BUT I'd prefer not to restore deleted games, so please try to just delete
            games you want to delete.
          </p>

          {/* Pagination Controls */}
          <div className="mt-2 md:mt-4 mb-2 md:mb-4 flex flex-col md:flex-row gap-2 md:gap-0 md:items-center md:justify-between bg-secondary-background text-secondary-text p-2 md:p-4 rounded-lg">
            <div className="flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1 md:gap-2">
                <label className="text-xs md:text-sm font-medium hidden md:inline">Games per page:</label>
                <select
                  value={gamesPerPage}
                  onChange={(e) => {
                    setGamesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-primary-background text-primary-text border border-primary-text/20 rounded px-1 md:px-2 py-0.5 md:py-1 text-xs md:text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
              <div className="text-xs md:text-sm">
                {startIndex + 1}-{Math.min(endIndex, totalGames)} of {totalGames}
              </div>
            </div>

            <div className="flex items-center gap-1 md:gap-2 flex-wrap">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-xs md:text-sm bg-tertiary-background text-tertiary-text rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tertiary-background/80"
              >
                <span className="hidden md:inline">First</span>
                <span className="md:hidden">«</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-xs md:text-sm bg-tertiary-background text-tertiary-text rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tertiary-background/80"
              >
                <span className="hidden md:inline">Previous</span>
                <span className="md:hidden">‹</span>
              </button>
              <span className="px-1 md:px-3 py-0.5 md:py-1 text-xs md:text-sm">
                {currentPage}/{totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-xs md:text-sm bg-tertiary-background text-tertiary-text rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tertiary-background/80"
              >
                <span className="hidden md:inline">Next</span>
                <span className="md:hidden">›</span>
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-1.5 md:px-3 py-0.5 md:py-1 text-xs md:text-sm bg-tertiary-background text-tertiary-text rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-tertiary-background/80"
              >
                <span className="hidden md:inline">Last</span>
                <span className="md:hidden">»</span>
              </button>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto text-xs md:text-sm">
            <table className="border-collapse border border-gray-300 w-full">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-1 md:px-4 py-1 md:py-2 text-left">Result</th>
                  <th className="border border-gray-300 px-1 md:px-4 py-1 md:py-2 text-left">Time</th>
                  <th className="border border-gray-300 px-1 md:px-4 py-1 md:py-2 text-left">Score</th>
                  <th className="border border-gray-300 px-1 md:px-4 py-1 md:py-2 text-center">Actions</th>
                  <th className="border border-gray-300 px-1 md:px-4 py-1 md:py-2 text-center">#</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGames.map((game, index) => (
                  <tr key={game.id} className="hover:bg-secondary-background/50">
                    <td
                      className="border border-gray-300 px-1 md:px-4 py-0.5 md:py-1 cursor-pointer hover:bg-blue-500/20"
                      onClick={() => navigate(`/1v1?player1=${game.winner}&player2=${game.loser}`)}
                    >
                      <span className="md:hidden">
                        {context.playerName(game.winner)} &gt; {context.playerName(game.loser)}
                      </span>
                      <span className="hidden md:inline">
                        {context.playerName(game.winner)} won over {context.playerName(game.loser)}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-1 md:px-4 py-0.5 md:py-1">
                      <p>{relativeTimeString(new Date(game.playedAt))}</p>
                      <p className="hidden md:block">
                        {new Date(game.playedAt).toLocaleDateString("nb-NO", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                      <p className="md:hidden text-[10px] opacity-80">
                        {new Date(game.playedAt).toLocaleDateString("nb-NO", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </td>
                    <td className="border border-gray-300 px-1 md:px-4 py-0.5 md:py-1">
                      {game.score && (
                        <div className="flex flex-col">
                          <span className="text-xs md:text-base font-bold whitespace-nowrap">
                            {game.score.setsWon.gameWinner}-{game.score.setsWon.gameLoser}
                          </span>
                          {game.score.setPoints && (
                            <span className="text-[10px] md:text-xs whitespace-nowrap">
                              {game.score.setPoints
                                .map((points) => points.gameWinner + "-" + points.gameLoser)
                                .join(", ")}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="border border-gray-300 px-1 md:px-4 py-0.5 md:py-1 text-center">
                      <div className="flex gap-1 md:gap-2 justify-center flex-col md:flex-row">
                        <button
                          className="text-[10px] md:text-xs bg-blue-500 hover:bg-blue-700 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md whitespace-nowrap"
                          onClick={() => navigate(`/game/edit/score?gameId=${game.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="text-[10px] md:text-xs bg-red-500 hover:bg-red-800 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md whitespace-nowrap"
                          onClick={() =>
                            window.confirm(
                              `Are you sure you want to delete the game where ${context.playerName(
                                game.winner,
                              )} won over ${context.playerName(game.loser)}?`,
                            ) && handleDeleteGame(game.id)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                    <td className="border border-gray-300 px-1 md:px-4 py-0.5 md:py-1 text-center">{fmtNum(totalGames - (startIndex + index))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "players" && (
        <PlayersTab onReactivatePlayer={handleReactivatePlayer} onDeactivatePlayer={handleDeactivatePlayer} />
      )}

      {activeTab === "users" && <Users />}

      {activeTab === "events" && <Events />}

      {activeTab === "local" && process.env.REACT_APP_ENV === "local" && <LocalAdminControls />}
    </div>
  );
};
