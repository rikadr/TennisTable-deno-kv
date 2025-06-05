import React, { useState } from "react";
import { queryClient } from "../../common/query-client";
import { relativeTimeString } from "../../common/date-utils";
import { Users } from "../users";
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
import { useNavigate } from "react-router-dom";
import { GamesPerMonthChart } from "./games-per-month";
import { GamesPerWeekChart } from "./games-per-week";
import { TopGamingDays } from "./top-days";

type TabType = "players" | "games" | "users" | "stats";
const tabs: { id: TabType; label: string }[] = [
  { id: "stats", label: "Stats" },
  { id: "games", label: "Games" },
  { id: "players", label: "Players" },
  { id: "users", label: "Users" },
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
    <div className="bg-primary-background">
      <h1>ADMIN PAGE</h1>
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
                    : "bg-primary-background text-secondary-background border border-secondary-background hover:bg-secondary-background hover:text-secondary-text"
                }`}
              >
                Monthly View
              </button>
              <button
                onClick={() => setChartView("weekly")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  chartView === "weekly"
                    ? "bg-secondary-background text-secondary-text"
                    : "bg-primary-background text-secondary-background border border-secondary-background hover:bg-secondary-background hover:text-secondary-text"
                }`}
              >
                Weekly View
              </button>
            </div>
          </div>

          {/* Chart Display */}
          {chartView === "monthly" ? <GamesPerMonthChart /> : <GamesPerWeekChart />}

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
                        {relativeTimeString(new Date(game.playedAt))}
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
                  <th className="border border-gray-300 px-4 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {/* Active Players */}
                {context.eventStore.playersProjector.players.map((player) => (
                  <tr key={player.id} className="hover:bg-secondary-background/50">
                    <td className="border border-gray-300 px-4 py-2">{player.name}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          className="text-xs bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded-md"
                          onClick={() => handleDeactivatePlayer(player.id)}
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
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Inactive
                      </span>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <button
                        className="text-xs bg-gray-400 hover:bg-green-400 text-white px-2 py-1 rounded-md"
                        onClick={() => handleReactivatePlayer(player.id)}
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
    </div>
  );
};
