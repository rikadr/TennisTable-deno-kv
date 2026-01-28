import React, { useState } from "react";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { relativeTimeString } from "../../common/date-utils";
import { EditPlayerName } from "./edit-player-name";
import { ProfilePicture } from "../player/profile-picture";

interface PlayersTabProps {
  onDeactivatePlayer: (playerId: string) => void;
  onReactivatePlayer: (playerId: string) => void;
}

type SortField = "name" | "createdAt" | "updatedAt";
type SortDirection = "asc" | "desc";

interface Player {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  updateAction?: string;
}

export const PlayersTab: React.FC<PlayersTabProps> = ({ onDeactivatePlayer, onReactivatePlayer }) => {
  const context = useEventDbContext();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortPlayers = (players: Player[]) => {
    return [...players].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "name":
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          return sortDirection === "asc" ? comparison : -comparison;
        case "createdAt":
          comparison = a.createdAt - b.createdAt;
          return sortDirection === "asc" ? -comparison : comparison;
        case "updatedAt":
          const aHasUpdated = !!a.updateAction;
          const bHasUpdated = !!b.updateAction;
          if (aHasUpdated && bHasUpdated) {
            comparison = a.updatedAt - b.updatedAt;
            return sortDirection === "asc" ? -comparison : comparison;
          }
          if (aHasUpdated) {
            return -1;
          }
          if (bHasUpdated) {
            return 1;
          }
      }
      return 0;
    });
  };

  function sortedActivePlayers() {
    return sortPlayers(context.eventStore.playersProjector.activePlayers);
  }

  function sortedInactivePlayers() {
    return sortPlayers(context.eventStore.playersProjector.inactivePlayers);
  }

  const formatDateTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("nb-NO", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  const handleDeactivate = (playerId: string) => {
    if (window.confirm(`Are you sure you want to deactivate ${context.playerName(playerId)}?`)) {
      onDeactivatePlayer(playerId);
    }
  };

  const handleReactivate = (playerId: string) => {
    if (window.confirm(`Are you sure you want to re-activate ${context.playerName(playerId)}?`)) {
      onReactivatePlayer(playerId);
    }
  };

  return (
    <div className="p-2 md:p-6">
      {/* Header Section */}
      <div className="mb-3 md:mb-6 space-y-1 md:space-y-2">
        <div className="flex gap-3 md:gap-6 text-xs md:text-sm">
          <p>
            <span className="font-semibold">Active:</span>{" "}
            {context.eventStore.playersProjector.activePlayers.length}
          </p>
          <p>
            <span className="font-semibold">Inactive:</span>{" "}
            {context.eventStore.playersProjector.inactivePlayers.length}
          </p>
        </div>
        <p className="text-xs md:text-sm text-primary-text/60 max-w-3xl hidden md:block">
          Deactivating players is reversible. No games will be deleted. It will only result in games with this player
          not counting towards anyone's ELO rating.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto shadow-sm rounded-lg border border-primary-text">
        <table className="min-w-full border-collapse text-xs md:text-sm">
          <thead className="bg-secondary-background text-secondary-text">
            <tr>
              <th
                className="border border-primary-text px-1 md:px-3 py-1 md:py-2 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center font-semibold">
                  <span className="md:hidden">Player</span>
                  <span className="hidden md:inline">Player Name</span>
                  <SortIcon field="name" />
                </div>
              </th>
              <th className="border border-primary-text px-1 md:px-3 py-1 md:py-2 text-left font-semibold hidden md:table-cell">Status</th>
              <th
                className="border border-primary-text px-1 md:px-3 py-1 md:py-2 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center font-semibold">
                  Created
                  <SortIcon field="createdAt" />
                </div>
              </th>
              <th
                className="border border-primary-text px-1 md:px-3 py-1 md:py-2 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("updatedAt")}
              >
                <div className="flex items-center font-semibold">
                  Updated
                  <SortIcon field="updatedAt" />
                </div>
              </th>
              <th className="border border-primary-text px-1 md:px-3 py-1 md:py-2 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Active Players */}
            {sortedActivePlayers().map((player) => (
              <tr key={player.id} className="hover:bg-primary-text/10 transition-colors">
                <td className="border border-primary-text px-1 md:px-3 py-0.5 md:py-1">
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="md:hidden shrink-0">
                      <ProfilePicture playerId={player.id} border={2} linkToPlayer size={32} shape="rounded" />
                    </div>
                    <div className="hidden md:block shrink-0">
                      <ProfilePicture playerId={player.id} border={3} linkToPlayer size={50} shape="rounded" />
                    </div>
                    <section className="min-w-0">
                      <h3 className="text-xs md:text-base truncate">{player.name}</h3>
                      <p className="text-secondary-text/30 text-[10px] md:text-xs truncate hidden md:block">{player.id}</p>
                    </section>
                  </div>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  <div className="space-y-0">
                    <p className="text-[10px] md:text-xs font-medium">{relativeTimeString(new Date(player.createdAt))}</p>
                    <p className="text-[10px] md:text-[11px] hidden md:block">{formatDateTime(player.createdAt)}</p>
                  </div>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  {player.createdAt !== player.updatedAt ? (
                    <div className="space-y-0">
                      <p className="text-[10px] md:text-xs font-medium">{relativeTimeString(new Date(player.updatedAt))}</p>
                      <p className="text-[10px] md:text-[11px] hidden md:block">{formatDateTime(player.updatedAt)}</p>
                      {player.updateAction && <p className="text-[10px] md:text-[11px] italic hidden md:block">{player.updateAction}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  <div className="flex gap-1 justify-center flex-col md:flex-row">
                    <button
                      className="text-[10px] md:text-xs bg-red-500 hover:bg-red-700 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md transition-colors whitespace-nowrap"
                      onClick={() => handleDeactivate(player.id)}
                    >
                      Deactivate
                    </button>
                    <EditPlayerName playerId={player.id} />
                  </div>
                </td>
              </tr>
            ))}

            {/* Inactive Players */}
            {sortedInactivePlayers().map((player) => (
              <tr key={player.id} className="bg-gray-700 text-gray-300 transition-colors">
                <td className="border border-primary-text px-1 md:px-3 py-0.5 md:py-1">
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="md:hidden shrink-0">
                      <ProfilePicture playerId={player.id} border={2} linkToPlayer size={32} shape="rounded" />
                    </div>
                    <div className="hidden md:block shrink-0">
                      <ProfilePicture playerId={player.id} border={3} linkToPlayer size={50} shape="rounded" />
                    </div>
                    <section className="min-w-0">
                      <h3 className="text-xs md:text-base truncate">{player.name}</h3>
                      <p className="text-secondary-text/30 text-[10px] md:text-xs truncate hidden md:block">{player.id}</p>
                    </section>
                  </div>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2 hidden md:table-cell">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-300 text-gray-700">
                    Inactive
                  </span>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  <div className="space-y-0">
                    <p className="text-[10px] md:text-xs font-medium">{relativeTimeString(new Date(player.createdAt))}</p>
                    <p className="text-[10px] md:text-[11px] hidden md:block">{formatDateTime(player.createdAt)}</p>
                  </div>
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  {player.createdAt !== player.updatedAt ? (
                    <div className="space-y-0">
                      <p className="text-[10px] md:text-xs font-medium">{relativeTimeString(new Date(player.updatedAt))}</p>
                      <p className="text-[10px] md:text-[11px] hidden md:block">{formatDateTime(player.updatedAt)}</p>
                      {player.updateAction && <p className="text-[10px] md:text-[11px] italic hidden md:block">{player.updateAction}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="border border-primary-text px-1 md:px-3 py-1 md:py-2">
                  <div className="flex justify-center">
                    <button
                      className="text-[10px] md:text-xs bg-green-500 hover:bg-green-600 text-white px-1 md:px-2 py-0.5 md:py-1 rounded-md transition-colors whitespace-nowrap"
                      onClick={() => handleReactivate(player.id)}
                    >
                      Re-activate
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
