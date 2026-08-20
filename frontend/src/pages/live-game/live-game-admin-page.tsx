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
import { CARD_SURFACE, fill, panelTint, ROW_SURFACE, softFill, textOn } from "../../common/player-color-styles";
import { session } from "../../services/auth";
import {
  useClearLiveGameMutation,
  useLiveGameQuery,
  useUpdateLiveGameMutation,
} from "./use-live-game";
import { emptyLiveGame, LiveGameSetPoint, LiveGameState } from "./live-game-types";
import { CompletedSetsList } from "./completed-sets-list";
import { LiveGamePredictionCard } from "./live-game-prediction-card";
import ConfettiExplosion from "react-confetti-explosion";
import { Server } from "../../common/serve-tracker";
import { ServeTrackerDisplay } from "../../common/serve-tracker-display";
import { BadSide, badSideLabel, nextSetBadSide } from "../../common/table-sides";
import { TableSideSelector } from "../../common/table-sides-display";
import { appendPoint, removeLastPoint, toEventTrackingData, trackingNow } from "../../common/point-sequences";

type Stage = "scoring" | "confirm";

export const LiveGameAdminPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const addEventMutation = useEventMutation();

  // Admin is the source of truth for writes — fetch once on mount, no polling.
  const liveGameQuery = useLiveGameQuery({ refetchIntervalMs: false });
  const updateLiveGame = useUpdateLiveGameMutation();
  const clearLiveGame = useClearLiveGameMutation();

  const [localState, setLocalState] = useState<LiveGameState | null>(null);
  const [validationError, setValidationError] = useState<string>("");
  const [stage, setStage] = useState<Stage>("scoring");
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);

  useEffect(() => {
    if (localState === null && liveGameQuery.isSuccess) {
      // Spread over emptyLiveGame so older games without newer fields (e.g.
      // firstServer) pick up sensible defaults.
      setLocalState(liveGameQuery.data ? { ...emptyLiveGame, ...liveGameQuery.data } : emptyLiveGame);
    }
  }, [localState, liveGameQuery.isSuccess, liveGameQuery.data]);

  if (session.sessionData?.role !== "admin") {
    return <div className="p-4">Not authorized</div>;
  }

  if (localState === null) {
    return <div className="p-4">Loading…</div>;
  }

  const isSubmitting = addEventMutation.isPending || clearLiveGame.isPending;
  const isActive = localState.startedAt !== null && !localState.finishedAt;
  const hasPlayers = !!localState.player1Id && !!localState.player2Id;

  // Each side of the score is built from the player's own colour, the same one their
  // name gets everywhere else.
  const player1Color = stringToColor(localState.player1Id || "");
  const player2Color = stringToColor(localState.player2Id || "");

  const setLeader: Server | null =
    localState.currentSet.player1 > localState.currentSet.player2
      ? 1
      : localState.currentSet.player2 > localState.currentSet.player1
        ? 2
        : null;

  function pushState(next: LiveGameState) {
    setLocalState(next);
    updateLiveGame.mutate(next);
  }

  function setPlayer(slot: 1 | 2, playerId: string | null) {
    setLocalState({
      ...localState!,
      [slot === 1 ? "player1Id" : "player2Id"]: playerId,
    });
  }

  function startMatch() {
    if (!hasPlayers) return;
    setStage("scoring");
    pushState({
      ...localState!,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [],
      currentSetSequence: "",
      currentSetPointTimes: [],
      completedSetSequences: [],
      completedSetPointTimes: [],
      completedSetFirstServers: [],
      firstServer: localState!.firstServer,
      completedSetBadSides: [],
      badSide: localState!.badSide,
      corrections: 0,
      startedAt: trackingNow(),
      endedAt: null,
      finishedAt: null,
      updatedAt: Date.now(),
    });
  }

  function setFirstServer(player: Server) {
    pushState({ ...localState!, firstServer: player });
  }

  function setBadSide(badSide: BadSide) {
    pushState({ ...localState!, badSide });
  }

  function addPoint(player: 1 | 2) {
    const key: keyof LiveGameSetPoint = player === 1 ? "player1" : "player2";
    const trackedSet = appendPoint(
      { sequence: localState!.currentSetSequence, pointTimes: localState!.currentSetPointTimes },
      player,
      trackingNow(),
    );
    pushState({
      ...localState!,
      currentSet: {
        ...localState!.currentSet,
        [key]: localState!.currentSet[key] + 1,
      },
      currentSetSequence: trackedSet.sequence,
      currentSetPointTimes: trackedSet.pointTimes,
    });
  }

  function removePoint(player: 1 | 2) {
    const key: keyof LiveGameSetPoint = player === 1 ? "player1" : "player2";
    const trackedSet = removeLastPoint(
      { sequence: localState!.currentSetSequence, pointTimes: localState!.currentSetPointTimes },
      player,
    );
    pushState({
      ...localState!,
      currentSet: {
        ...localState!.currentSet,
        [key]: Math.max(0, localState!.currentSet[key] - 1),
      },
      currentSetSequence: trackedSet.sequence,
      currentSetPointTimes: trackedSet.pointTimes,
      corrections: localState!.corrections + 1,
    });
  }

  function setWon(player: 1 | 2) {
    pushState({
      ...localState!,
      setsWon: {
        player1: localState!.setsWon.player1 + (player === 1 ? 1 : 0),
        player2: localState!.setsWon.player2 + (player === 2 ? 1 : 0),
      },
      completedSets: [...localState!.completedSets, { ...localState!.currentSet }],
      currentSet: { player1: 0, player2: 0 },
      completedSetSequences: [...localState!.completedSetSequences, localState!.currentSetSequence],
      completedSetPointTimes: [...localState!.completedSetPointTimes, localState!.currentSetPointTimes],
      completedSetFirstServers: [...localState!.completedSetFirstServers, localState!.firstServer],
      completedSetBadSides: [...localState!.completedSetBadSides, localState!.badSide],
      currentSetSequence: "",
      currentSetPointTimes: [],
      // Alternate who serves first in the next set, per table tennis convention.
      firstServer: localState!.firstServer === 1 ? 2 : 1,
      // The players change sides after every set, so the bad side moves to the
      // other player. The admin can correct it if this pair does not change.
      badSide: nextSetBadSide(localState!.badSide),
    });
  }

  function resetMatch() {
    if (!window.confirm("Reset current match score? Players stay selected.")) return;
    pushState({
      ...localState!,
      setsWon: { player1: 0, player2: 0 },
      currentSet: { player1: 0, player2: 0 },
      completedSets: [],
      currentSetSequence: "",
      currentSetPointTimes: [],
      completedSetSequences: [],
      completedSetPointTimes: [],
      completedSetFirstServers: [],
      firstServer: 1,
      completedSetBadSides: [],
      badSide: null,
      corrections: 0,
      // The match restarts, so its timeline restarts with it.
      startedAt: trackingNow(),
      endedAt: null,
      updatedAt: Date.now(),
    });
  }

  async function endLiveGame() {
    if (!window.confirm("End this live game? This clears the public scoreboard.")) return;
    await clearLiveGame.mutateAsync();
    setLocalState(emptyLiveGame);
  }

  function reviewMatch() {
    setValidationError("");
    if (!localState!.player1Id || !localState!.player2Id) {
      setValidationError("Both players must be selected");
      return;
    }
    if (localState!.setsWon.player1 === localState!.setsWon.player2) {
      setValidationError("Match is tied — complete another set before saving.");
      return;
    }
    pushState({ ...localState!, endedAt: trackingNow() });
    setStage("confirm");
  }

  async function saveAsGame() {
    setValidationError("");
    const player1Won = localState!.setsWon.player1 > localState!.setsWon.player2;
    const winner = player1Won ? localState!.player1Id! : localState!.player2Id!;
    const loser = player1Won ? localState!.player2Id! : localState!.player1Id!;
    const winnerSets = player1Won ? localState!.setsWon.player1 : localState!.setsWon.player2;
    const loserSets = player1Won ? localState!.setsWon.player2 : localState!.setsWon.player1;

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

    // Both are undefined when the tracked points do not line up with the
    // completed sets, e.g. a live game that started before this tracking
    // existed. They are always saved together.
    const trackingData = toEventTrackingData({
      completedSets: localState!.completedSets,
      trackedSets: localState!.completedSetSequences.map((sequence, index) => ({
        sequence,
        pointTimes: localState!.completedSetPointTimes[index] ?? [],
      })),
      firstServers: localState!.completedSetFirstServers,
      badSides: localState!.completedSetBadSides,
      player1IsGameWinner: player1Won,
      source: "live-game",
      startedAt: localState!.startedAt,
      endedAt: localState!.endedAt,
      corrections: localState!.corrections,
    });

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: {
        setsWon: { gameWinner: winnerSets, gameLoser: loserSets },
        setPoints:
          localState!.completedSets.length > 0
            ? localState!.completedSets.map((set) => ({
                gameWinner: player1Won ? set.player1 : set.player2,
                gameLoser: player1Won ? set.player2 : set.player1,
              }))
            : undefined,
        pointSequences: trackingData?.pointSequences,
        tracking: trackingData?.tracking,
      },
    };

    const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
    if (validateScore.valid === false) {
      setValidationError(validateScore.message);
      return;
    }

    const isPendingTournamentGame = context.tournaments.findAllPendingGames(winner, loser);

    await addEventMutation.mutateAsync(gameCreatedEvent);
    await addEventMutation.mutateAsync(gameScoreEvent);
    updateLiveGame.mutate({ ...localState!, finishedAt: Date.now() });
    setGameSuccessfullyAdded(true);
    queryClient.invalidateQueries();
    setTimeout(() => {
      navigate(
        isPendingTournamentGame.length > 0
          ? `/tournament?tournament=${isPendingTournamentGame[0].tournament.id}&player1=${isPendingTournamentGame[0].player1}&player2=${isPendingTournamentGame[0].player2}`
          : `/1v1/?player1=${winner}&player2=${loser}`,
      );
    }, 2_000);
  }

  return (
    <div className="p-2 sm:p-4 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-3">
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

      {isActive && hasPlayers && stage === "scoring" && (
        <div className="space-y-3">
          <div className="bg-white rounded-xl shadow-lg p-3 tall:p-4 sm:p-4 text-black">
            <div className="flex justify-center items-center gap-3 xs:gap-6">
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <ProfilePicture playerId={localState.player1Id} size={40} border={2} />
                <span
                  className="font-bold text-xs truncate max-w-full"
                  style={textOn(player1Color, CARD_SURFACE)}
                >
                  {context.playerName(localState.player1Id)}
                </span>
              </div>
              {/* Big numbers are sets, the small ones under them are the points of
                  the set being played. */}
              <div className="flex flex-col items-center bg-gray-50 px-3 py-1 rounded-xl shadow-inner">
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-black">{localState.setsWon.player1}</span>
                  <span className="font-bold text-xl">-</span>
                  <span className="text-3xl font-black">{localState.setsWon.player2}</span>
                </div>
                <div className="text-xs font-bold text-gray-500 leading-none pb-0.5">
                  ({localState.currentSet.player1}-{localState.currentSet.player2})
                </div>
              </div>
              <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                <ProfilePicture playerId={localState.player2Id} size={40} border={2} />
                <span
                  className="font-bold text-xs truncate max-w-full"
                  style={textOn(player2Color, CARD_SURFACE)}
                >
                  {context.playerName(localState.player2Id)}
                </span>
              </div>
            </div>
            {/* Set number and serve tracker share one row to save height */}
            <div className="mt-2 tall:mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
              <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold">
                Set {localState.completedSets.length + 1}
              </h2>
              <ServeTrackerDisplay
                currentSet={localState.currentSet}
                firstServer={localState.firstServer}
                player1Name={context.playerName(localState.player1Id)}
                player2Name={context.playerName(localState.player2Id)}
                player1Color={player1Color}
                player2Color={player2Color}
                onSelectFirstServer={setFirstServer}
              />
            </div>
            {/* Which side of the table the players have this set */}
            <div className="mt-1.5 tall:mt-2">
              <TableSideSelector
                badSide={localState.badSide}
                player1Name={context.playerName(localState.player1Id)}
                player2Name={context.playerName(localState.player2Id)}
                player1Color={player1Color}
                player2Color={player2Color}
                onSelect={setBadSide}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 tall:gap-3 mt-2 tall:mt-3">
              <PlayerScoreControls
                name={context.playerName(localState.player1Id)}
                score={localState.currentSet.player1}
                onAdd={() => addPoint(1)}
                onRemove={() => removePoint(1)}
                color={player1Color}
              />
              <PlayerScoreControls
                name={context.playerName(localState.player2Id)}
                score={localState.currentSet.player2}
                onAdd={() => addPoint(2)}
                onRemove={() => removePoint(2)}
                color={player2Color}
              />
            </div>

            {/* Whoever leads the current set is the only possible set winner, so a
                single button covers both players. */}
            <button
              onClick={() => setLeader && setWon(setLeader)}
              disabled={setLeader === null}
              className={classNames(
                "w-full py-2.5 tall:py-3 mt-2 tall:mt-3 rounded-lg font-semibold text-base",
                setLeader === null ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "hover:brightness-95",
              )}
              style={setLeader === null ? undefined : fill(setLeader === 1 ? player1Color : player2Color)}
            >
              {setLeader === null
                ? "Set won by leading player"
                : `Set won by ${context.playerName(
                    setLeader === 1 ? localState.player1Id : localState.player2Id,
                  )}`}
            </button>
          </div>

          <LiveGamePredictionCard
            player1Id={localState.player1Id!}
            player2Id={localState.player2Id!}
            player1Name={context.playerName(localState.player1Id)}
            player2Name={context.playerName(localState.player2Id)}
            setsWon={localState.setsWon}
            currentSet={localState.currentSet}
            completedSets={localState.completedSets}
          />

          <CompletedSetsList
            sets={localState.completedSets}
            badSides={localState.completedSetBadSides}
            player1Name={context.playerName(localState.player1Id)}
            player2Name={context.playerName(localState.player2Id)}
            player1Color={player1Color}
            player2Color={player2Color}
          />

          {validationError && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={reviewMatch}
              disabled={isSubmitting}
              className={classNames(
                "w-full py-2.5 tall:py-3 rounded-lg font-semibold text-base",
                isSubmitting
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-green-600 text-white hover:bg-green-700",
              )}
            >
              End Match & Review
            </button>
            {/* The two secondary actions share a row to save height */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={resetMatch}
                disabled={isSubmitting}
                className="py-2.5 tall:py-3 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50"
              >
                Reset score
              </button>
              <button
                onClick={endLiveGame}
                disabled={isSubmitting}
                className="py-2.5 tall:py-3 rounded-lg font-semibold bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
              >
                ❌ End live game
              </button>
            </div>
          </div>
        </div>
      )}

      {isActive && hasPlayers && stage === "confirm" && (
        <ConfirmView
          localState={localState}
          context={context}
          validationError={validationError}
          isSubmitting={isSubmitting}
          gameSuccessfullyAdded={gameSuccessfullyAdded}
          onConfirm={saveAsGame}
          onBack={() => { setStage("scoring"); setValidationError(""); }}
        />
      )}
    </div>
  );
};

const PlayerScoreControls: React.FC<{
  name: string;
  score: number;
  onAdd: () => void;
  onRemove: () => void;
  /** The player's own colour (`#rrggbb`), which this side of the score is built from. */
  color: string;
}> = ({ name, score, onAdd, onRemove, color }) => {
  const tint = panelTint(color);
  return (
    <div className="rounded-lg p-2 tall:p-3" style={{ backgroundColor: tint }}>
      <h3 className="text-sm font-semibold text-gray-700 mb-0.5 tall:mb-1 text-center truncate">{name}</h3>
      <div className="flex flex-col items-center justify-center gap-1.5 tall:gap-2">
        <div className="text-5xl tall:text-6xl font-bold text-center" style={textOn(color, tint)}>
          {score}
        </div>
        <div className="flex flex-col gap-1.5 tall:gap-2 w-full items-center">
          <button
            onClick={onAdd}
            className="w-full h-24 tall:h-32 text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
            style={fill(color)}
          >
            +
          </button>
          <button
            onClick={onRemove}
            disabled={score === 0}
            className={classNames(
              "w-full h-11 tall:h-12 text-center rounded-lg transition text-2xl font-bold",
              score === 0 ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "hover:brightness-95",
            )}
            style={score === 0 ? undefined : softFill(color)}
          >
            -
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmView: React.FC<{
  localState: LiveGameState;
  context: { playerName: (id: string | null) => string };
  validationError: string;
  isSubmitting: boolean;
  gameSuccessfullyAdded: boolean;
  onConfirm: () => void;
  onBack: () => void;
}> = ({ localState, context, validationError, isSubmitting, gameSuccessfullyAdded, onConfirm, onBack }) => {
  const player1Color = stringToColor(localState.player1Id || "");
  const player2Color = stringToColor(localState.player2Id || "");
  const player1Won = localState.setsWon.player1 > localState.setsWon.player2;
  const winnerId = player1Won ? localState.player1Id : localState.player2Id;
  const winnerColor = player1Won ? player1Color : player2Color;

  return (
    <div className="space-y-4">
      {gameSuccessfullyAdded && (
        <div className="flex justify-center">
          <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
        </div>
      )}
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 text-black">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">🏆 Match Complete!</h1>
          <p className="text-lg text-gray-600">
            Winner:{" "}
            <span className="font-bold" style={textOn(winnerColor, CARD_SURFACE)}>
              {context.playerName(winnerId)}
            </span>
          </p>
          <div className="m-auto w-fit mt-2">
            <ProfilePicture playerId={winnerId} size={140} border={8} shape="rounded" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-3 items-center text-center">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">{context.playerName(localState.player1Id)}</h3>
              <div className="text-4xl font-bold" style={textOn(player1Color, ROW_SURFACE)}>
                {localState.setsWon.player1}
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-400">-</div>
            <div>
              <h3 className="font-semibold text-gray-700 mb-2 text-sm">{context.playerName(localState.player2Id)}</h3>
              <div className="text-4xl font-bold" style={textOn(player2Color, ROW_SURFACE)}>
                {localState.setsWon.player2}
              </div>
            </div>
          </div>
        </div>

        {localState.completedSets.length > 0 && (
          <div className="mb-4">
            <h3 className="text-base font-bold text-gray-800 mb-2">Set Details</h3>
            <div className="space-y-2">
              {localState.completedSets.map((set, index) => {
                const setWinner = set.player1 > set.player2 ? 1 : 2;
                const sideLabel = badSideLabel(
                  localState.completedSetBadSides[index],
                  context.playerName(localState.player1Id),
                  context.playerName(localState.player2Id),
                );
                return (
                  <div key={index} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-700">Set {index + 1}</span>
                      {sideLabel && <span className="text-xs text-gray-400">🚧 {sideLabel}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-5">{setWinner === 1 && "🏆"}</div>
                      <div className="w-16 flex items-center justify-between text-lg">
                        <span
                          className={classNames("font-bold", setWinner !== 1 && "text-gray-400")}
                          style={setWinner === 1 ? textOn(player1Color, ROW_SURFACE) : undefined}
                        >
                          {set.player1}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span
                          className={classNames("font-bold", setWinner !== 2 && "text-gray-400")}
                          style={setWinner === 2 ? textOn(player2Color, ROW_SURFACE) : undefined}
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
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
            {validationError}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={() => !gameSuccessfullyAdded && onConfirm()}
            disabled={isSubmitting || gameSuccessfullyAdded}
            className={classNames(
              "w-full py-3 rounded-lg font-semibold transition text-base",
              isSubmitting || gameSuccessfullyAdded
                ? "bg-gray-400 text-white cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700",
            )}
          >
            {isSubmitting ? "Saving…" : "✅ Confirm & Save"}
          </button>
          <button
            onClick={onBack}
            disabled={isSubmitting || gameSuccessfullyAdded}
            className="w-full py-3 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {"<-"} Back
          </button>
        </div>
      </div>
    </div>
  );
};
