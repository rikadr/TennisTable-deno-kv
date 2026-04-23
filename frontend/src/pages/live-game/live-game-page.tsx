import React from "react";
import { useLiveGameQuery } from "./use-live-game";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { Link } from "react-router-dom";
import { session } from "../../services/auth";
import { CompletedSetsList } from "./completed-sets-list";
import { LiveGameSetPoint } from "./live-game-types";

// Fallback poll in case the WebSocket drops — primary updates come from
// the LIVE_GAME broadcast handled in WebSocketRefetcher.
const POLL_FALLBACK_MS = 3_000;

const ONE_HOUR_MS = 60 * 60 * 1000;

export const LiveGamePage: React.FC = () => {
  const context = useEventDbContext();
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: POLL_FALLBACK_MS });

  const isAdmin = session.sessionData?.role === "admin";
  const state = liveGameQuery.data;
  const isActive = !!state && !!state.player1Id && !!state.player2Id && state.startedAt !== null && !state.finishedAt;
  const isFinished = !!state && !!state.player1Id && !!state.player2Id && !!state.finishedAt && (Date.now() - state.finishedAt) < ONE_HOUR_MS;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary-text">Live Game</h1>
        <div className="flex items-center gap-2">
          {isActive && (
            <Link
              to="/live-game/overlay"
              className="text-sm px-3 py-1 rounded-md bg-secondary-background text-secondary-text hover:opacity-80"
            >
              TV Overlay
            </Link>
          )}
          {isAdmin && (
            <Link
              to="/live-game/admin"
              className="text-sm px-3 py-1 rounded-md bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/80"
            >
              Admin
            </Link>
          )}
        </div>
      </div>

      {liveGameQuery.isLoading && (
        <div className="text-center py-16 text-primary-text/70">Loading…</div>
      )}

      {!liveGameQuery.isLoading && !isActive && !isFinished && (
        <div className="bg-secondary-background text-secondary-text rounded-xl p-8 text-center">
          <p className="text-lg font-semibold">No live game is currently being played.</p>
          <p className="text-sm mt-2 opacity-80">Check back soon — this page updates automatically.</p>
        </div>
      )}

      {isActive && state && (
        <LiveScoreboard
          player1Id={state.player1Id!}
          player2Id={state.player2Id!}
          setsWon={state.setsWon}
          currentSet={state.currentSet}
          completedSets={state.completedSets}
          player1Name={context.playerName(state.player1Id)}
          player2Name={context.playerName(state.player2Id)}
        />
      )}

      {isFinished && state && (
        <FinishedScoreboard
          player1Id={state.player1Id!}
          player2Id={state.player2Id!}
          setsWon={state.setsWon}
          completedSets={state.completedSets}
          player1Name={context.playerName(state.player1Id)}
          player2Name={context.playerName(state.player2Id)}
        />
      )}
    </div>
  );
};

type ScoreboardProps = {
  player1Id: string;
  player2Id: string;
  setsWon: { player1: number; player2: number };
  currentSet: LiveGameSetPoint;
  completedSets: LiveGameSetPoint[];
  player1Name: string;
  player2Name: string;
};

const LiveScoreboard: React.FC<ScoreboardProps> = ({
  player1Id,
  player2Id,
  setsWon,
  currentSet,
  completedSets,
  player1Name,
  player2Name,
}) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-4 text-black">
        <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 text-center">
          Match Score
        </h2>
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <ProfilePicture playerId={player1Id} size={80} border={3} />
            <span
              className="font-bold text-base text-center truncate max-w-full"
              style={{ color: stringToColor(player1Id) }}
            >
              {player1Name}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-6xl font-black">{setsWon.player1}</span>
            <span className="font-bold text-3xl text-gray-400">-</span>
            <span className="text-6xl font-black">{setsWon.player2}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProfilePicture playerId={player2Id} size={80} border={3} />
            <span
              className="font-bold text-base text-center truncate max-w-full"
              style={{ color: stringToColor(player2Id) }}
            >
              {player2Name}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 text-black">
        <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 text-center">
          Current Set {completedSets.length + 1}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-1 truncate">{player1Name}</h3>
            <div className="text-7xl font-bold text-blue-600">{currentSet.player1}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <h3 className="text-sm font-semibold text-gray-700 mb-1 truncate">{player2Name}</h3>
            <div className="text-7xl font-bold text-purple-600">{currentSet.player2}</div>
          </div>
        </div>
      </div>

      <CompletedSetsList sets={completedSets} />
    </div>
  );
};

type FinishedScoreboardProps = {
  player1Id: string;
  player2Id: string;
  setsWon: { player1: number; player2: number };
  completedSets: LiveGameSetPoint[];
  player1Name: string;
  player2Name: string;
};

const FinishedScoreboard: React.FC<FinishedScoreboardProps> = ({
  player1Id,
  player2Id,
  setsWon,
  completedSets,
  player1Name,
  player2Name,
}) => {
  const player1Won = setsWon.player1 > setsWon.player2;
  const winnerId = player1Won ? player1Id : player2Id;
  const winnerName = player1Won ? player1Name : player2Name;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-6 text-black">
        <div className="text-center mb-4">
          <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">Final Score</h2>
          <p className="text-lg text-gray-600">
            Winner: <span className="font-bold text-indigo-600">{winnerName}</span>
          </p>
          <div className="m-auto w-fit mt-2 mb-4">
            <ProfilePicture playerId={winnerId} size={80} border={4} />
          </div>
        </div>
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex flex-col items-center gap-2">
            <ProfilePicture playerId={player1Id} size={60} border={3} />
            <span
              className="font-bold text-base text-center truncate max-w-full"
              style={{ color: stringToColor(player1Id) }}
            >
              {player1Name}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-6xl font-black">{setsWon.player1}</span>
            <span className="font-bold text-3xl text-gray-400">-</span>
            <span className="text-6xl font-black">{setsWon.player2}</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProfilePicture playerId={player2Id} size={60} border={3} />
            <span
              className="font-bold text-base text-center truncate max-w-full"
              style={{ color: stringToColor(player2Id) }}
            >
              {player2Name}
            </span>
          </div>
        </div>
      </div>

      <CompletedSetsList sets={completedSets} />
    </div>
  );
};
