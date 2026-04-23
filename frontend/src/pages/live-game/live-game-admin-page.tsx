import React, { useEffect, useState } from "react";
import { StepSelectPlayers } from "../add-game/step-select-players";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useNavigate } from "react-router-dom";
import {
  EventTypeEnum,
  GameCreated,
  GameScore,
} from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { session } from "../../services/auth";
import {
  useClearLiveGameMutation,
  useLiveGameQuery,
  useUpdateLiveGameMutation,
} from "./use-live-game";
import { emptyLiveGame, LiveGameSetPoint, LiveGameState } from "./live-game-types";

export const LiveGameAdminPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const addEventMutation = useEventMutation();

  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: 5_000 });
  const updateLiveGame = useUpdateLiveGameMutation();
  const clearLiveGame = useClearLiveGameMutation();

  const [localState, setLocalState] = useState<LiveGameState>(emptyLiveGame);
  const [syncedFromServer, setSyncedFromServer] = useState(false);
  const [validationError, setValidationError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!syncedFromServer && liveGameQuery.data !== undefined) {
      setLocalState(liveGameQuery.data ?? emptyLiveGame);
      setSyncedFromServer(true);
    }
  }, [liveGameQuery.data, syncedFromServer]);

  if (session.sessionData?.role !== "admin") {
    return <div className="p-4">Not authorized</div>;
  }

  const isActive = localState.startedAt !== null;
  const hasPlayers = !!localState.player1Id && !!localState.player2Id;

  function pushState(next: LiveGameState) {
    setLocalState(next);
    updateLiveGame.mutate(next);
  }

  function setPlayer(slot: 1 | 2, playerId: string | null) {
    const next: LiveGameState = {
      ...localState,
      [slot === 1 ? "player1Id" : "player2Id"]: playerId,
    };
    setLocalState(next);
  }

  function startMatch() {
    if (!hasPlayers) return;
    const next: LiveGameState = {
      ...localState,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [],
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    pushState(next);
  }

  function addPoint(player: 1 | 2) {
    const key: keyof LiveGameSetPoint = player === 1 ? "player1" : "player2";
    const next: LiveGameState = {
      ...localState,
      currentSet: {
        ...localState.currentSet,
        [key]: localState.currentSet[key] + 1,
      },
    };
    pushState(next);
  }

  function removePoint(player: 1 | 2) {
    const key: keyof LiveGameSetPoint = player === 1 ? "player1" : "player2";
    const next: LiveGameState = {
      ...localState,
      currentSet: {
        ...localState.currentSet,
        [key]: Math.max(0, localState.currentSet[key] - 1),
      },
    };
    pushState(next);
  }

  function setWon(player: 1 | 2) {
    const completed: LiveGameSetPoint = {
      player1: localState.currentSet.player1,
      player2: localState.currentSet.player2,
    };
    const next: LiveGameState = {
      ...localState,
      setsWon: {
        player1: localState.setsWon.player1 + (player === 1 ? 1 : 0),
        player2: localState.setsWon.player2 + (player === 2 ? 1 : 0),
      },
      completedSets: [...localState.completedSets, completed],
      currentSet: { player1: 0, player2: 0 },
    };
    pushState(next);
  }

  function resetMatch() {
    if (!window.confirm("Reset current match score? Players stay selected.")) return;
    const next: LiveGameState = {
      ...localState,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [],
      startedAt: localState.startedAt,
      updatedAt: Date.now(),
    };
    pushState(next);
  }

  function endLiveGame() {
    if (!window.confirm("End this live game? This clears the public scoreboard.")) return;
    clearLiveGame.mutate(undefined, {
      onSuccess: () => {
        setLocalState(emptyLiveGame);
      },
    });
  }

  async function saveAsGame() {
    setValidationError("");
    if (!localState.player1Id || !localState.player2Id) {
      setValidationError("Both players must be selected");
      return;
    }
    if (localState.setsWon.player1 === localState.setsWon.player2) {
      setValidationError("Match is tied — complete another set before saving.");
      return;
    }

    const player1WinnerSide = localState.setsWon.player1 > localState.setsWon.player2;
    const winner = player1WinnerSide ? localState.player1Id : localState.player2Id;
    const loser = player1WinnerSide ? localState.player2Id : localState.player1Id;

    const now = Date.now();
    const gameCreatedEvent: GameCreated = {
      type: EventTypeEnum.GAME_CREATED,
      time: now,
      stream: newId(),
      data: { winner, loser, playedAt: now },
    };

    const validateCreated = context.eventStore.gamesProjector.validateCreateGame(gameCreatedEvent);
    if (validateCreated.valid === false) {
      setValidationError(validateCreated.message);
      return;
    }

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: {
        setsWon: {
          gameWinner: player1WinnerSide ? localState.setsWon.player1 : localState.setsWon.player2,
          gameLoser: player1WinnerSide ? localState.setsWon.player2 : localState.setsWon.player1,
        },
        setPoints:
          localState.completedSets.length > 0
            ? localState.completedSets.map((set) => ({
                gameWinner: player1WinnerSide ? set.player1 : set.player2,
                gameLoser: player1WinnerSide ? set.player2 : set.player1,
              }))
            : undefined,
      },
    };

    const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
    if (validateScore.valid === false) {
      setValidationError(validateScore.message);
      return;
    }

    setIsSubmitting(true);
    try {
      await addEventMutation.mutateAsync(gameCreatedEvent);
      await addEventMutation.mutateAsync(gameScoreEvent);
      await new Promise<void>((resolve) => {
        clearLiveGame.mutate(undefined, {
          onSuccess: () => resolve(),
          onError: () => resolve(),
        });
      });
      setLocalState(emptyLiveGame);
      queryClient.invalidateQueries();
      navigate(`/1v1/?player1=${winner}&player2=${loser}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-primary-text">Live Game Admin</h1>
        <button
          onClick={() => navigate("/live-game")}
          className="text-sm px-3 py-1 rounded-md bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/80"
        >
          View public
        </button>
      </div>

      {!isActive && (
        <div className="space-y-4">
          <div className="bg-secondary-background text-secondary-text rounded-lg p-3 text-sm">
            Select the two players, then press Start to make the game visible on the public /live-game page.
          </div>
          <StepSelectPlayers
            player1={{ id: localState.player1Id, set: (id) => setPlayer(1, id) }}
            player2={{ id: localState.player2Id, set: (id) => setPlayer(2, id) }}
          />
          {hasPlayers && (
            <button
              onClick={startMatch}
              disabled={updateLiveGame.isPending}
              className="w-full py-3 rounded-lg font-semibold bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/80 disabled:opacity-50"
            >
              Start live game
            </button>
          )}
        </div>
      )}

      {isActive && hasPlayers && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-lg p-4 text-black">
            <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3 text-center">
              Total Score
            </h2>
            <div className="flex justify-center items-center gap-6 mb-2">
              <div className="flex flex-col items-center gap-1">
                <ProfilePicture playerId={localState.player1Id} size={50} border={2} />
                <span
                  className="font-bold text-sm"
                  style={{ color: stringToColor(localState.player1Id || "") }}
                >
                  {context.playerName(localState.player1Id)}
                </span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 px-4 py-1 rounded-xl shadow-inner">
                <span className="text-3xl font-black">{localState.setsWon.player1}</span>
                <span className="font-bold text-xl">-</span>
                <span className="text-3xl font-black">{localState.setsWon.player2}</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ProfilePicture playerId={localState.player2Id} size={50} border={2} />
                <span
                  className="font-bold text-sm"
                  style={{ color: stringToColor(localState.player2Id || "") }}
                >
                  {context.playerName(localState.player2Id)}
                </span>
              </div>
            </div>
            <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mt-4 text-center">
              Set {localState.completedSets.length + 1}
            </h2>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-4 text-black">
            <div className="grid grid-cols-2 gap-2">
              <PlayerScoreControls
                name={context.playerName(localState.player1Id)}
                score={localState.currentSet.player1}
                onAdd={() => addPoint(1)}
                onRemove={() => removePoint(1)}
                colorClasses={{
                  bg: "bg-blue-50",
                  score: "text-blue-600",
                  addBtn: "bg-blue-600 hover:bg-blue-700",
                  removeBtn: "bg-blue-400 hover:bg-blue-500",
                }}
              />
              <PlayerScoreControls
                name={context.playerName(localState.player2Id)}
                score={localState.currentSet.player2}
                onAdd={() => addPoint(2)}
                onRemove={() => removePoint(2)}
                colorClasses={{
                  bg: "bg-purple-50",
                  score: "text-purple-600",
                  addBtn: "bg-purple-600 hover:bg-purple-700",
                  removeBtn: "bg-purple-400 hover:bg-purple-500",
                }}
              />
            </div>

            <div className="space-y-2 mt-4">
              <button
                onClick={() => setWon(1)}
                disabled={localState.currentSet.player1 <= localState.currentSet.player2}
                className={classNames(
                  "w-full py-3 rounded-lg font-semibold text-base",
                  localState.currentSet.player1 > localState.currentSet.player2
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed",
                )}
              >
                Set won by {context.playerName(localState.player1Id)}
              </button>
              <button
                onClick={() => setWon(2)}
                disabled={localState.currentSet.player2 <= localState.currentSet.player1}
                className={classNames(
                  "w-full py-3 rounded-lg font-semibold text-base",
                  localState.currentSet.player2 > localState.currentSet.player1
                    ? "bg-purple-500 text-white hover:bg-purple-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed",
                )}
              >
                Set won by {context.playerName(localState.player2Id)}
              </button>
            </div>
          </div>

          {localState.completedSets.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4 text-black">
              <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">
                Completed Sets
              </h3>
              <div className="space-y-2">
                {localState.completedSets.map((set, index) => {
                  const setWinner = set.player1 > set.player2 ? 1 : 2;
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <span className="font-semibold text-gray-700">Set {index + 1}</span>
                      <div className="flex items-center gap-3">
                        <div className="w-5">{setWinner === 1 && "🏆"}</div>
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

          {validationError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={saveAsGame}
              disabled={isSubmitting}
              className={classNames(
                "w-full py-3 rounded-lg font-semibold text-base",
                isSubmitting
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700",
              )}
            >
              {isSubmitting ? "Saving…" : "✅ Save match & end live game"}
            </button>
            <button
              onClick={resetMatch}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
            >
              Reset score
            </button>
            <button
              onClick={endLiveGame}
              disabled={isSubmitting}
              className="w-full py-3 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              ❌ End live game (discard)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

type ScoreControlsProps = {
  name: string;
  score: number;
  onAdd: () => void;
  onRemove: () => void;
  colorClasses: {
    bg: string;
    score: string;
    addBtn: string;
    removeBtn: string;
  };
};

const PlayerScoreControls: React.FC<ScoreControlsProps> = ({
  name,
  score,
  onAdd,
  onRemove,
  colorClasses,
}) => {
  return (
    <div className={classNames("rounded-lg p-2", colorClasses.bg)}>
      <h3 className="text-sm font-semibold text-gray-700 mb-1 text-center truncate">{name}</h3>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className={classNames("text-5xl font-bold text-center", colorClasses.score)}>
          {score}
        </div>
        <div className="flex flex-col gap-2 w-full items-center">
          <button
            onClick={onAdd}
            className={classNames(
              "w-full max-w-28 aspect-square text-center text-white text-4xl font-bold rounded-lg transition",
              colorClasses.addBtn,
            )}
          >
            +
          </button>
          <button
            onClick={onRemove}
            disabled={score === 0}
            className={classNames(
              "w-full max-w-28 h-12 text-center rounded-lg transition text-2xl font-bold",
              score === 0
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : classNames("text-white", colorClasses.removeBtn),
            )}
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
};
