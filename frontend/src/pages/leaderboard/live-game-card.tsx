import React from "react";
import { Link } from "react-router-dom";
import { UseQueryResult } from "@tanstack/react-query";
import { LiveGameState } from "../live-game/live-game-types";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";

const ONE_HOUR_MS = 60 * 60 * 1000;

type Props = {
  liveGameQuery: UseQueryResult<LiveGameState | null>;
};

export const LiveGameCard: React.FC<Props> = ({ liveGameQuery }) => {
  const context = useEventDbContext();
  const state = liveGameQuery.data;
  const isActive = !!state && !!state.player1Id && !!state.player2Id && state.startedAt !== null && !state.finishedAt;
  const isFinished = !!state && !!state.player1Id && !!state.player2Id && !!state.finishedAt && (Date.now() - state.finishedAt) < ONE_HOUR_MS;

  if ((!isActive && !isFinished) || !state) return null;

  const player1Won = state.setsWon.player1 > state.setsWon.player2;
  const winnerName = player1Won ? context.playerName(state.player1Id) : context.playerName(state.player2Id);

  return (
    <Link
      to="/live-game"
      className={`w-full rounded-lg p-3 text-white shadow-lg transition-all ${
        isFinished
          ? "bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400"
          : "bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
          )}
          <span className="text-xs font-bold uppercase tracking-wider">
            {isFinished ? `Final Score — ${winnerName} wins!` : "Live Now"}
          </span>
        </div>
        <span className="text-xs opacity-80">Tap to view</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col items-center gap-1 min-w-0">
          <ProfilePicture playerId={state.player1Id!} size={32} border={2} />
          <span className="font-semibold text-sm truncate max-w-[100px]">{context.playerName(state.player1Id)}</span>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Sets</span>
          <div className="flex items-center gap-1 text-2xl font-black">
            <span>{state.setsWon.player1}</span>
            <span className="opacity-60">-</span>
            <span>{state.setsWon.player2}</span>
          </div>
          {isActive && (
            <>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 mt-1">Points</span>
              <div className="flex items-center gap-1 text-base font-semibold opacity-90">
                <span>{state.currentSet.player1}</span>
                <span className="opacity-60">-</span>
                <span>{state.currentSet.player2}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 min-w-0">
          <ProfilePicture playerId={state.player2Id!} size={32} border={2} />
          <span className="font-semibold text-sm truncate max-w-[100px]">{context.playerName(state.player2Id)}</span>
        </div>
      </div>
    </Link>
  );
};
