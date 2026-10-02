import React from "react";
import { useSearchParams } from "react-router-dom";
import { classNames } from "../common/class-names";
import { useTennisParams } from "../hooks/use-tennis-params";
import { useEventDbContext } from "../wrappers/event-db-context";
import { ProfilePicture } from "./player/profile-picture";
import { PvPGameHistory, PvPWins, WinChancePrediction } from "./pvp-stats";

// The left column stays on the screen while the games scroll. Only a screen with enough
// height does this: on a shorter screen the bottom of the column would stay below the screen.
// The highest column (with the unranked warning) is about 680px, plus the 64px top offset
const STICKY_ON_TALL_SCREENS = "lg:[@media(min-height:760px)]:sticky lg:top-16";

export const PvPPage: React.FC = () => {
  const { player1, player2 } = useTennisParams();
  const [, setSearchParams] = useSearchParams();

  // The url is the source of truth for the selected players, so the browser
  // back button steps through the pairings the user selected on this page.
  const selectPlayers = (players: { player1?: string; player2?: string }) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      if (players.player1) newParams.set("player1", players.player1);
      if (players.player2) newParams.set("player2", players.player2);
      return newParams;
    });
  };

  const bothSelected = !!player1 && !!player2;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 text-primary-text">
      <div
        className={classNames(
          "grid grid-cols-1 gap-4 items-start",
          bothSelected && "lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]",
        )}
      >
        <div className={classNames("space-y-3", bothSelected ? STICKY_ON_TALL_SCREENS : "max-w-xl w-full mx-auto")}>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
            <PlayerPicker
              value={player1 ?? undefined}
              otherPlayer={player2 ?? undefined}
              onChange={(value) => selectPlayers({ player1: value })}
            />
            <button
              onClick={() => selectPlayers({ player1: player2 ?? undefined, player2: player1 ?? undefined })}
              disabled={!bothSelected}
              title="Swap the players"
              aria-label="Swap the players"
              className="mb-6 rounded-full w-9 h-9 flex items-center justify-center bg-secondary-background text-secondary-text hover:bg-secondary-background/70 disabled:opacity-40 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <PlayerPicker
              value={player2 ?? undefined}
              otherPlayer={player1 ?? undefined}
              onChange={(value) => selectPlayers({ player2: value })}
            />
          </div>

          {bothSelected ? (
            <>
              <PvPWins player1={player1} player2={player2} />
              <WinChancePrediction player1={player1} player2={player2} />
            </>
          ) : (
            <p className="text-center text-lg text-primary-text/70 py-8">Select 2 players to compare</p>
          )}
        </div>

        {bothSelected && <PvPGameHistory player1={player1} player2={player2} />}
      </div>
    </div>
  );
};

/**
 * The picture and the name of a player, with a native select on top of them.
 * A phone opens its own list of players, a computer opens a dropdown.
 */
const PlayerPicker: React.FC<{ value?: string; otherPlayer?: string; onChange: (value: string) => void }> = ({
  value,
  otherPlayer,
  onChange,
}) => {
  const context = useEventDbContext();
  const sortedPlayers = [...context.players].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return (
    <div className="relative group flex flex-col items-center gap-2 min-w-0">
      <div className="rounded-full ring-2 ring-transparent group-hover:ring-primary-text/40 group-focus-within:ring-primary-text transition">
        <ProfilePicture playerId={value} size={64} border={3} />
      </div>
      <div className="w-full text-center font-bold text-base sm:text-lg truncate">
        {value ? context.playerName(value) : "Select player"}
        <span className="ml-1 text-xs opacity-50 group-hover:opacity-100">▾</span>
      </div>
      <select
        aria-label="Select player"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {!value && <option value="">Select player</option>}
        {sortedPlayers.map((player) => (
          <option value={player.id} key={player.id} disabled={player.id === otherPlayer}>
            {player.name}
          </option>
        ))}
      </select>
    </div>
  );
};
