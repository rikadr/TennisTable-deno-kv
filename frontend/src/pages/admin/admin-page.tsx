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
import { EditPlayerName } from "./edit-player-name";
import { fmtNum } from "../../common/number-utils";
import { Link, useNavigate } from "react-router-dom";
import { GamesPerMonthChart } from "./games-per-month";
import { GamesPerWeekChart } from "./games-per-week";
import { TopGamingDays } from "./top-days";
import { GamesPerWeekdayChart } from "./games-weekdays";
import { GamesPerTimeChart } from "./hour-of-the-day";
import { LocalAdminControls } from "./local-admin-controls";
import { Events } from "./events";
import { classNames } from "../../common/class-names";

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

  const addEventMutation = useEventMutation();

  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [chartView, setChartView] = useState<"monthly" | "weekly">("monthly");

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
          <h2>Total distribution of games played</h2>
          <AllPlayerGamesDistrubution />
        </>
      )}

      {activeTab === "games" && (
        <>
          <p>Games: {context.eventStore.gamesProjector.games.length}</p>
          <p>
            Deleting games is not permanent BUT I'd prefer not to restore deleted games, so please try to just delete
            games you want to delete.
          </p>

          <div className="mt-2 overflow-x-auto text-sm">
            <table className="border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">Result</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Time</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Score</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">#</th>
                </tr>
              </thead>
              <tbody>
                {context.eventStore.gamesProjector.games
                  .slice()
                  .reverse()
                  .map((game, index, list) => (
                    <tr key={game.id} className="hover:bg-secondary-background/50">
                      <td className="border border-gray-300 px-4 py-1">
                        {context.playerName(game.winner)} won over {context.playerName(game.loser)}
                      </td>
                      <td className="border border-gray-300 px-4 py-1">
                        <p>{relativeTimeString(new Date(game.playedAt))}</p>
                        <p>
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
                      </td>
                      <td className="border border-gray-300 px-4 py-1">
                        {game.score && (
                          <div>
                            <p>
                              <span className="text-base font-bold">
                                {game.score.setsWon.gameWinner}-{game.score.setsWon.gameLoser}
                              </span>
                              {game.score.setPoints && (
                                <span className="text-xs">
                                  {" "}
                                  (
                                  {game.score.setPoints
                                    .map((points) => points.gameWinner + "-" + points.gameLoser)
                                    .join(", ")}
                                  )
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-1 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="text-xs bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded-md"
                            onClick={() => navigate(`/game/edit/score?gameId=${game.id}`)}
                          >
                            Edit Score
                          </button>
                          <button
                            className="text-xs bg-red-500 hover:bg-red-800 text-white px-2 py-1 rounded-md"
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
                      <td className="border border-gray-300 px-4 py-1">{fmtNum(list.length - index)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "players" && (
        <>
          <p>Active players: {context.eventStore.playersProjector.players.length}</p>
          <p className="mt-2 text-sm">Inactive players: {context.eventStore.playersProjector.inactivePlayers.length}</p>
          <p>
            Deactivating players is reverable. No games will be deleted. It will only result in games with this player
            not counting towards anyone's elo rating.
          </p>

          <div className="mt-2 overflow-x-auto">
            <table className="border-collapse border border-gray-300">
              <thead>
                <tr>
                  <th className="border border-gray-300 px-4 py-2 text-left">Player Name</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Status</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Created at</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">Updated at</th>
                  <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Active Players */}
                {context.eventStore.playersProjector.players
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
                  .map((player) => (
                    <tr key={player.id} className="hover:bg-secondary-background/50">
                      <td className="border border-gray-300 px-4 py-2">
                        <Link to={`/player/${player.id}`}>{player.name}</Link>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      </td>
                      <td className="border border-gray-300 px-4 py-1">
                        <p>{relativeTimeString(new Date(player.createdAt))}</p>
                        <p>
                          {new Date(player.createdAt).toLocaleDateString("nb-NO", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="border border-gray-300 px-4 py-1">
                        {player.createdAt !== player.updatedAt ? (
                          <>
                            <p>{relativeTimeString(new Date(player.updatedAt))}</p>
                            <p>
                              {new Date(player.updatedAt).toLocaleDateString("nb-NO", {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </p>
                            {player.updateAction && <p>{player.updateAction}</p>}
                          </>
                        ) : (
                          <>-</>
                        )}
                      </td>
                      <td className="border border-gray-300 px-4 py-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            className="text-xs bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded-md"
                            onClick={() =>
                              window.confirm("Are you sure you want to deactivate " + context.playerName(player.id)) &&
                              handleDeactivatePlayer(player.id)
                            }
                          >
                            Deactivate
                          </button>
                          <EditPlayerName playerId={player.id} />
                        </div>
                      </td>
                    </tr>
                  ))}

                {/* Inactive Players */}
                {context.eventStore.playersProjector.inactivePlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-secondary-background/50 bg-gray-25">
                    <td className="border border-gray-300 px-4 py-2 text-gray-600">{player.name}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-400 text-gray-800">
                        Inactive
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-1">
                      <p>{relativeTimeString(new Date(player.createdAt))}</p>
                      <p>
                        {new Date(player.createdAt).toLocaleDateString("nb-NO", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                    </td>
                    <td className="border border-gray-300 px-4 py-1">
                      {player.createdAt !== player.updatedAt ? (
                        <>
                          <p>{relativeTimeString(new Date(player.updatedAt))}</p>
                          <p>
                            {new Date(player.updatedAt).toLocaleDateString("nb-NO", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </p>
                          {player.updateAction && <p>{player.updateAction}</p>}
                        </>
                      ) : (
                        <>-</>
                      )}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <button
                        className="text-xs bg-gray-400 hover:bg-green-400 text-white px-2 py-1 rounded-md"
                        onClick={() =>
                          window.confirm("Are you sure you want to re-activate " + context.playerName(player.id)) &&
                          handleReactivatePlayer(player.id)
                        }
                      >
                        Re-activate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === "users" && <Users />}

      {activeTab === "events" && <Events />}

      {activeTab === "local" && process.env.REACT_APP_ENV === "local" && <LocalAdminControls />}
    </div>
  );
};
