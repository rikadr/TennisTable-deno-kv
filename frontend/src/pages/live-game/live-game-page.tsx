import React from "react";
import { useLiveGameQuery } from "./use-live-game";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { classNames } from "../../common/class-names";
import { Link } from "react-router-dom";
import { session } from "../../services/auth";

export const LiveGamePage: React.FC = () => {
  const context = useEventDbContext();
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: 2_000 });

  const isAdmin = session.sessionData?.role === "admin";
  const state = liveGameQuery.data;
  const isActive = !!state && !!state.player1Id && !!state.player2Id && state.startedAt !== null;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary-text">Live Game</h1>
        {isAdmin && (
          <Link
            to="/live-game/admin"
            className="text-sm px-3 py-1 rounded-md bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/80"
          >
            Admin
          </Link>
        )}
      </div>

      {liveGameQuery.isLoading && (
        <div className="text-center py-16 text-primary-text/70">Loading…</div>
      )}

      {!liveGameQuery.isLoading && !isActive && (
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
    </div>
  );
};

type ScoreboardProps = {
  player1Id: string;
  player2Id: string;
  setsWon: { player1: number; player2: number };
  currentSet: { player1: number; player2: number };
  completedSets: { player1: number; player2: number }[];
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

      {completedSets.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-4 text-black">
          <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
            Completed Sets
          </h3>
          <div className="space-y-2">
            {completedSets.map((set, index) => {
              const setWinner = set.player1 > set.player2 ? 1 : 2;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                >
                  <span className="font-semibold text-gray-700">Set {index + 1}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-5 text-right">{setWinner === 1 && "🏆"}</div>
                    <div className="w-16 flex items-center justify-between text-lg">
                      <span
                        className={classNames(
                          "font-bold",
                          setWinner === 1 ? "text-blue-600" : "text-gray-400",
                        )}
                      >
                        {set.player1}
                      </span>
                      <span className="text-gray-400">-</span>
                      <span
                        className={classNames(
                          "font-bold",
                          setWinner === 2 ? "text-purple-600" : "text-gray-400",
                        )}
                      >
                        {set.player2}
                      </span>
                    </div>
                    <div className="w-5">{setWinner === 2 && "🏆"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
