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
    <div className="p-6">
      {/* Header Section */}
      <div className="mb-6 space-y-2">
        <div className="flex gap-6 text-sm">
          <p>
            <span className="font-semibold">Active players:</span>{" "}
            {context.eventStore.playersProjector.activePlayers.length}
          </p>
          <p>
            <span className="font-semibold">Inactive players:</span>{" "}
            {context.eventStore.playersProjector.inactivePlayers.length}
          </p>
        </div>
        <p className="text-sm text-primary-text/60 max-w-3xl">
          Deactivating players is reversible. No games will be deleted. It will only result in games with this player
          not counting towards anyone's ELO rating.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto shadow-sm rounded-lg border border-primary-text">
        <table className="min-w-full border-collapse">
          <thead className="bg-secondary-background text-secondary-text">
            <tr>
              <th
                className="border border-primary-text px-4 py-3 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center font-semibold">
                  Player Name
                  <SortIcon field="name" />
                </div>
              </th>
              <th className="border border-primary-text px-4 py-3 text-left font-semibold">Status</th>
              <th
                className="border border-primary-text px-4 py-3 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("createdAt")}
              >
                <div className="flex items-center font-semibold">
                  Created At
                  <SortIcon field="createdAt" />
                </div>
              </th>
              <th
                className="border border-primary-text px-4 py-3 text-left cursor-pointer hover:bg-secondary-text/50 transition-colors"
                onClick={() => handleSort("updatedAt")}
              >
                <div className="flex items-center font-semibold">
                  Updated At
                  <SortIcon field="updatedAt" />
                </div>
              </th>
              <th className="border border-primary-text px-4 py-3 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Active Players */}
            {sortedActivePlayers().map((player) => (
              <tr key={player.id} className="hover:bg-primary-text/10 transition-colors">
                <td className="border border-primary-text px-4 py-1">
                  <div className="flex items-center gap-3">
                    <ProfilePicture playerId={player.id} border={4} linkToPlayer size={70} shape="rounded" />
                    <section>
                      <h3 className="text-lg">{player.name}</h3>
                      <p className="text-secondary-text/30">{player.id}</p>
                    </section>
                  </div>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{relativeTimeString(new Date(player.createdAt))}</p>
                    <p className="text-xs">{formatDateTime(player.createdAt)}</p>
                  </div>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  {player.createdAt !== player.updatedAt ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{relativeTimeString(new Date(player.updatedAt))}</p>
                      <p className="text-xs">{formatDateTime(player.updatedAt)}</p>
                      {player.updateAction && <p className="text-xs italic">{player.updateAction}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <div className="flex gap-2 justify-center">
                    <button
                      className="text-xs bg-red-500 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors"
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
              <tr key={player.id} className="bg-gray-700 text-gray-300  transition-colors">
                <td className="border border-primary-text px-4 py-1">
                  <div className="flex items-center gap-3">
                    <ProfilePicture playerId={player.id} border={4} linkToPlayer size={70} shape="rounded" />
                    <section>
                      <h3 className="text-lg">{player.name}</h3>
                      <p className="text-secondary-text/30">{player.id}</p>
                    </section>
                  </div>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-300 text-gray-700">
                    Inactive
                  </span>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{relativeTimeString(new Date(player.createdAt))}</p>
                    <p className="text-xs">{formatDateTime(player.createdAt)}</p>
                  </div>
                </td>
                <td className="border border-primary-text px-4 py-3">
                  {player.createdAt !== player.updatedAt ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{relativeTimeString(new Date(player.updatedAt))}</p>
                      <p className="text-xs">{formatDateTime(player.updatedAt)}</p>
                      {player.updateAction && <p className="text-xs italic">{player.updateAction}</p>}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="border border-primary-text px-4 py-3">
                  <div className="flex justify-center">
                    <button
                      className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-md transition-colors"
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
