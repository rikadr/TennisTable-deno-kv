import React, { useState } from "react";
import { queryClient } from "../../common/query-client";
import { Users } from "./users";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useToast } from "../../wrappers/toast-provider";
import { session } from "../../services/auth";
import { AllPlayerGamesDistrubution } from "./all-player-games-distribution";
import { useEventMutation } from "../../hooks/use-event-mutation";
import {
  EventTypeEnum,
  GameDeleted,
  PlayerDeactivated,
  PlayerReactivated,
} from "../../client/client-db/event-store/event-types";
import { useSearchParams } from "react-router-dom";
import { GamesPerMonthChart } from "./games-per-month";
import { GamesPerWeekChart } from "./games-per-week";
import { TopGamingDays } from "./top-days";
import { TopPlayers } from "./top-players";
import { TopPlayerPairings } from "./top-player-pairings";
import { GamesPerWeekdayChart } from "./games-weekdays";
import { GamesPerTimeChart } from "./hour-of-the-day";
import { LocalAdminControls } from "./local-admin-controls";
import { Events } from "./events";
import { classNames } from "../../common/class-names";
import { PlayersTab } from "./players";
import { AdminGamesTab } from "./games";
import { PlayerDiversityChart } from "./player-diversity-chart";
import { PlayerGameCount } from "./player-game-count";
import { HallOfFameCategoryBalance } from "./hall-of-fame-category-balance";

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
  const [searchParams, setSearchParams] = useSearchParams();

  const addEventMutation = useEventMutation();
  const { showToast } = useToast();

  const activeTab = (searchParams.get("tab") as TabType) || "stats";

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

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
      showToast("error", validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries() });
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
      showToast("error", validateResponse.message);
      return;
    }

    addEventMutation.mutate(event, { onSuccess: () => queryClient.invalidateQueries() });
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
      showToast("error", validateResponse.message);
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
                className={classNames(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  chartView === "monthly"
                    ? "bg-secondary-background text-secondary-text"
                    : "bg-primary-background text-primary-text/75 border border-primary-text hover:bg-secondary-background hover:text-secondary-text",
                )}
              >
                Monthly View
              </button>
              <button
                onClick={() => setChartView("weekly")}
                className={classNames(
                  "px-4 py-2 rounded-lg font-medium transition-colors",
                  chartView === "weekly"
                    ? "bg-secondary-background text-secondary-text"
                    : "bg-primary-background text-primary-text/75 border border-primary-text hover:bg-secondary-background hover:text-secondary-text",
                )}
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
          <TopPlayers />
          <TopPlayerPairings />
          <PlayerGameCount />
          <PlayerDiversityChart />
          <HallOfFameCategoryBalance />
          <h2>Total distribution of games played</h2>
          <AllPlayerGamesDistrubution />
        </>
      )}

      {activeTab === "games" && <AdminGamesTab onDeleteGame={handleDeleteGame} />}

      {activeTab === "players" && (
        <PlayersTab onReactivatePlayer={handleReactivatePlayer} onDeactivatePlayer={handleDeactivatePlayer} />
      )}

      {activeTab === "users" && <Users />}

      {activeTab === "events" && <Events />}

      {activeTab === "local" && process.env.REACT_APP_ENV === "local" && <LocalAdminControls />}
    </div>
  );
};
