import React, { useEffect, useState } from "react";
import { StepSelectPlayers } from "./step-select-players";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useNavigate } from "react-router-dom";
import { EventType, EventTypeEnum, GameCreated, GameScore } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import { PendingTournamentGame } from "./pending-tournament-game";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { stringToColor } from "../../common/string-to-color";
import { CARD_SURFACE, fill, panelTint, ROW_SURFACE, softFill, textOn } from "../../common/player-color-styles";
import { getServeInfo, Server } from "../../common/serve-tracker";
import { ServeTrackerDisplay } from "../../common/serve-tracker-display";
import { BadSide, badSideLabel, gameWinnerSideOfBadSide, nextSetBadSide } from "../../common/table-sides";
import { TableSideDisplay } from "../../common/table-sides-display";
import { LiveGamePredictionCard } from "../live-game/live-game-prediction-card";
import { session } from "../../services/auth";
import { useLiveGameQuery, useUpdateLiveGameMutation } from "../live-game/use-live-game";
import { DEFAULT_BEST_OF } from "../live-game/live-game-types";
import {
  appendPoint,
  emptyTrackedSet,
  removeLastPoint,
  toEventTrackingData,
  TrackedSet,
} from "../../common/point-sequences";
import {
  clearTrackedGame,
  loadTrackedGame,
  MatchData,
  PendingSave,
  saveTrackedGame,
  StoredTrackedGame,
} from "./tracked-game-storage";

interface SetPoint {
  player1: number;
  player2: number;
}

type Stage = "player-selection" | "scoring";

export const TrackGamePage: React.FC = () => {
  const context = useEventDbContext();
  // A failed save shows inline and keeps the game, so it must not throw during render.
  const addEventMutation = useEventMutation({ suppressErrorToast: true, throwOnError: false });
  const navigate = useNavigate();
  const params = useTennisParams();

  // A tracked game that was left before it was saved. Read once, so the page
  // continues from it and ignores the players in the url.
  const [restored] = useState(loadTrackedGame);

  // True when the url asks for players that are not in the restored game, e.g.
  // a tournament match link on a device with a game that was not saved.
  const [restoredOtherMatch, setRestoredOtherMatch] = useState(
    () =>
      restored !== null &&
      [params.player1, params.player2].some(
        (player) => !!player && player !== restored.player1 && player !== restored.player2,
      ),
  );

  const [stage, setStage] = useState<Stage>(restored ? "scoring" : "player-selection");
  const [player1, setPlayer1] = useState<string | null>(restored?.player1 ?? params.player1);
  const [player2, setPlayer2] = useState<string | null>(restored?.player2 ?? params.player2);
  const [matchData, setMatchData] = useState<MatchData>(
    restored?.matchData ?? {
      setsWon: { player1: 0, player2: 0 },
      setPoints: [],
      trackedSets: [],
      firstServers: [],
      badSides: [],
    },
  );
  const [currentSetScore, setCurrentSetScore] = useState<SetPoint>(
    restored?.currentSetScore ?? { player1: 0, player2: 0 },
  );
  // The points of the current set, in the order they were scored.
  const [currentTrackedSet, setCurrentTrackedSet] = useState<TrackedSet>(
    restored?.currentTrackedSet ?? emptyTrackedSet,
  );
  const [firstServer, setFirstServer] = useState<Server>(restored?.firstServer ?? 1);
  // Who has the bad side of the table in the set being played. Null until the
  // operator records it, and the sides are only saved when every set has one.
  const [badSide, setBadSide] = useState<BadSide>(restored?.badSide ?? null);
  // Epoch ms the match started, and how many points were undone. Saved with
  // the game so its timeline can be replayed.
  const [startedAt, setStartedAt] = useState<number | null>(restored?.startedAt ?? null);
  const [corrections, setCorrections] = useState(restored?.corrections ?? 0);
  // Set when a save starts, and kept until the save is complete. While it is
  // set the scoring is locked, so a retry saves the same game.
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(restored?.pendingSave ?? null);
  const [validationError, setValidationError] = useState<string>("");
  // Stays true after a successful save, until the game details page opens.
  const [isSaving, setIsSaving] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const locked = isSaving || pendingSave !== null;

  /** The game as localStorage keeps it, or null before the match starts. */
  const snapshot = (save: PendingSave | null): StoredTrackedGame | null => {
    if (stage !== "scoring" || !player1 || !player2 || startedAt === null) return null;
    return {
      player1,
      player2,
      matchData,
      currentSetScore,
      currentTrackedSet,
      firstServer,
      badSide,
      startedAt,
      corrections,
      pendingSave: save,
    };
  };

  // Keep the game in localStorage while it is tracked. Leaving the page does
  // not lose it: the add game pages lead back here and the game continues.
  useEffect(() => {
    const game = snapshot(pendingSave);
    if (game) setStorageFailed(saveTrackedGame(game) === false);
    // snapshot reads only the values listed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stage,
    player1,
    player2,
    matchData,
    currentSetScore,
    currentTrackedSet,
    firstServer,
    badSide,
    startedAt,
    corrections,
    pendingSave,
  ]);

  // The scoring screen is colour coded per player instead of a fixed
  // blue/purple pair, so each side matches the colour the player has everywhere else.
  const player1Color = stringToColor(player1 || "");
  const player2Color = stringToColor(player2 || "");

  const isAdmin = session.isAuthenticated && session.sessionData?.role === "admin";
  // Only fetched to warn before overwriting a broadcast that is already running.
  const liveGameQuery = useLiveGameQuery({ enabled: isAdmin });
  const updateLiveGame = useUpdateLiveGameMutation();

  const addPoint = (player: number) => {
    const key = `player${player}` as keyof SetPoint;
    setCurrentSetScore({ ...currentSetScore, [key]: currentSetScore[key] + 1 });
    const at = Date.now();
    setCurrentTrackedSet((prev) => appendPoint(prev, player as 1 | 2, at));
  };

  const removePoint = (player: number) => {
    const key = `player${player}` as keyof SetPoint;
    if (currentSetScore[key] === 0) return;
    setCurrentSetScore({ ...currentSetScore, [key]: currentSetScore[key] - 1 });
    setCurrentTrackedSet((prev) => removeLastPoint(prev, player as 1 | 2));
    setCorrections((prev) => prev + 1);
  };

  const setWon = (player: number) => {
    const newSetPoint: SetPoint = {
      player1: currentSetScore.player1,
      player2: currentSetScore.player2,
    };

    setMatchData((prev) => ({
      setsWon: {
        player1: prev.setsWon.player1 + (player === 1 ? 1 : 0),
        player2: prev.setsWon.player2 + (player === 2 ? 1 : 0),
      },
      setPoints: [...(prev.setPoints || []), newSetPoint],
      trackedSets: [...prev.trackedSets, currentTrackedSet],
      firstServers: [...prev.firstServers, firstServer],
      badSides: [...prev.badSides, badSide],
    }));

    setCurrentSetScore({ player1: 0, player2: 0 });
    setCurrentTrackedSet(emptyTrackedSet);
    // Alternate who serves first in the next set, per table tennis convention.
    setFirstServer((prev) => (prev === 1 ? 2 : 1));
    // The players change sides after every set, so the bad side moves to the
    // other player. The operator can correct it if this pair does not change.
    setBadSide(nextSetBadSide);
  };

  const startMatch = () => {
    setStartedAt(Date.now());
    setStage("scoring");
  };

  /**
   * Which events of a game the server has. Loads the events first, and throws
   * when that fails, because the cached events cannot answer this.
   */
  async function eventsOnServer(stream: string): Promise<{ created: boolean; scored: boolean }> {
    await queryClient.refetchQueries({ queryKey: ["event-db"] }, { throwOnError: true });
    const events = (queryClient.getQueryData<EventType[]>(["event-db"]) ?? []).filter(
      (event) => event.stream === stream,
    );
    return {
      created: events.some((event) => event.type === EventTypeEnum.GAME_CREATED),
      scored: events.some((event) => event.type === EventTypeEnum.GAME_SCORE),
    };
  }

  /** Saves the game and opens its details page. There is no review step. */
  async function endMatch() {
    if (!player1 || !player2 || isSaving) return;
    setValidationError("");

    const player1Won = matchData.setsWon.player1 > matchData.setsWon.player2;
    const winner = player1Won ? player1 : player2;
    const loser = player1Won ? player2 : player1;
    const completedSets = matchData.setPoints || [];

    // A retry keeps the stream and the time of the first attempt. The server
    // rejects a second event with the same time, so no event is stored twice.
    const save: PendingSave = pendingSave ?? { stream: newId(), playedAt: Date.now() };
    const isRetry = pendingSave !== null;
    const { playedAt } = save;
    const gameCreatedEvent: GameCreated = {
      type: EventTypeEnum.GAME_CREATED,
      time: playedAt,
      stream: save.stream,
      data: { winner, loser, playedAt },
    };

    if (!isRetry) {
      const validateCreated = context.eventStore.gamesProjector.validateCreateGame(gameCreatedEvent);
      if (validateCreated.valid === false) {
        console.error(validateCreated.message);
        setValidationError(validateCreated.message);
        return;
      }
    }

    // Both are undefined when the tracked points do not line up with the
    // completed sets. They are always saved together.
    const trackingData = toEventTrackingData({
      completedSets,
      trackedSets: matchData.trackedSets,
      firstServers: matchData.firstServers,
      player1IsGameWinner: player1Won,
      source: "track-game",
      startedAt,
      endedAt: playedAt,
      corrections,
    });

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: {
        setsWon: {
          gameWinner: player1Won ? matchData.setsWon.player1 : matchData.setsWon.player2,
          gameLoser: player1Won ? matchData.setsWon.player2 : matchData.setsWon.player1,
        },
        setPoints:
          completedSets.length > 0
            ? completedSets.map((set) => ({
                gameWinner: player1Won ? set.player1 : set.player2,
                gameLoser: player1Won ? set.player2 : set.player1,
              }))
            : undefined,
        gameWinnerSides: matchData.badSides.some((side) => side !== null)
          ? completedSets.map((_, index) =>
              gameWinnerSideOfBadSide(matchData.badSides[index] ?? null, player1Won ? 1 : 2),
            )
          : undefined,
        pointSequences: trackingData?.pointSequences,
        tracking: trackingData?.tracking,
      },
    };

    const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
    if (validateScore.valid === false) {
      console.error(validateScore.message);
      setValidationError(validateScore.message);
      return;
    }

    setIsSaving(true);
    try {
      // A request of the first attempt can have reached the server without a
      // response. Send only the events that the server does not have.
      let onServer = { created: false, scored: false };
      if (isRetry) {
        onServer = await eventsOnServer(save.stream);
      } else {
        // Store the save before the first request, so a retry after a reload
        // also continues from it.
        setPendingSave(save);
        const game = snapshot(save);
        if (game) saveTrackedGame(game);
      }
      if (!onServer.created) await addEventMutation.mutateAsync(gameCreatedEvent);
      if (!onServer.scored) await addEventMutation.mutateAsync(gameScoreEvent);
    } catch (error) {
      console.error(error);
      setValidationError(
        "Could not save the game. The match is kept on this device. Check your connection and press End Match again.",
      );
      setIsSaving(false);
      return;
    }

    clearTrackedGame();
    // The game details page reads the game from the events, so load them first.
    await queryClient.invalidateQueries().catch(console.error);
    navigate(`/game?time=${playedAt}`);
  }

  /**
   * Hands the match over to the broadcasted live game, keeping the score so far.
   * From there the admin page is in charge of scoring, the public /live-game page
   * follows along, and the game is saved from that flow instead of this one.
   */
  async function convertToBroadcastedLiveGame() {
    if (!player1 || !player2) return;
    setValidationError("");

    const running = liveGameQuery.data;
    const isRunning = !!running?.player1Id && !!running?.player2Id && running.startedAt !== null && !running.finishedAt;
    if (
      isRunning &&
      !window.confirm(
        `${context.playerName(running.player1Id)} vs ${context.playerName(
          running.player2Id,
        )} is being broadcasted right now. Replace it with this match?`,
      )
    ) {
      return;
    }

    const now = Date.now();
    try {
      await updateLiveGame.mutateAsync({
        player1Id: player1,
        player2Id: player2,
        setsWon: { ...matchData.setsWon },
        currentSet: { ...currentSetScore },
        completedSets: matchData.setPoints ?? [],
        currentSetSequence: currentTrackedSet.sequence,
        currentSetPointTimes: [...currentTrackedSet.pointTimes],
        completedSetSequences: matchData.trackedSets.map((set) => set.sequence),
        completedSetPointTimes: matchData.trackedSets.map((set) => [...set.pointTimes]),
        completedSetFirstServers: [...matchData.firstServers],
        firstServer,
        completedSetBadSides: [...matchData.badSides],
        badSide,
        corrections,
        bestOf: DEFAULT_BEST_OF,
        // Keep the original start so the timeline stays continuous across the
        // handover. Only a match that skipped the scoring screen starts now.
        startedAt: startedAt ?? now,
        endedAt: null,
        finishedAt: null,
        updatedAt: now,
      });
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not start the broadcasted live game");
      return;
    }
    clearTrackedGame();
    navigate("/live-game/admin");
  }

  const cancelMatch = async () => {
    if (!window.confirm("Cancel this match? The tracked points are deleted.")) return;
    setValidationError("");

    // A save that did not complete can have left the game on the server. Then
    // the match is not only on this device, and a cancel here cannot remove it.
    if (pendingSave) {
      setIsSaving(true);
      try {
        const onServer = await eventsOnServer(pendingSave.stream);
        if (onServer.scored) {
          clearTrackedGame();
          navigate(`/game?time=${pendingSave.playedAt}`);
          return;
        }
        if (onServer.created) {
          setValidationError(
            "The server already has this game, but not its score. Press End Match again to save the score.",
          );
          setIsSaving(false);
          return;
        }
      } catch (error) {
        console.error(error);
        setValidationError("Could not check if the server has this game. Check your connection and try again.");
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    clearTrackedGame();
    setStage("player-selection");
    setPlayer1(null);
    setPlayer2(null);
    setMatchData({
      setsWon: { player1: 0, player2: 0 },
      setPoints: [],
      trackedSets: [],
      firstServers: [],
      badSides: [],
    });
    setCurrentSetScore({ player1: 0, player2: 0 });
    setCurrentTrackedSet(emptyTrackedSet);
    setFirstServer(1);
    setBadSide(null);
    setStartedAt(null);
    setCorrections(0);
    setPendingSave(null);
    setRestoredOtherMatch(false);
    setValidationError("");
  };

  // Player Selection Screen
  if (stage === "player-selection") {
    return (
      <div className="p-4 max-w-xl m-auto">
        {player1 && player2 && (
          <PendingTournamentGame key={`${player1}-${player2}`} player1={player1} player2={player2} />
        )}

        <div className="max-w-sm mx-auto pt-4 sm:pt-8 space-y-4">
          <StepSelectPlayers player1={{ id: player1, set: setPlayer1 }} player2={{ id: player2, set: setPlayer2 }} />
          {player1 && player2 && (
            <button
              onClick={startMatch}
              className="w-full py-3 rounded-lg font-semibold transition text-base bg-tertiary-background text-tertiary-text hover:bg-tertiary-background/50"
            >
              Start match!
            </button>
          )}
        </div>
      </div>
    );
  }

  // Scoring Screen
  if (stage === "scoring") {
    // Whoever leads the current set is the only possible set winner, so a single
    // button covers both players.
    const setLeader: Server | null =
      currentSetScore.player1 > currentSetScore.player2
        ? 1
        : currentSetScore.player2 > currentSetScore.player1
          ? 2
          : null;
    const setLeaderColor = setLeader === 1 ? player1Color : player2Color;
    const isSetEmpty = currentSetScore.player1 === 0 && currentSetScore.player2 === 0;
    const canEndMatch =
      (matchData.setPoints?.length || 0) > 0 && isSetEmpty && matchData.setsWon.player1 !== matchData.setsWon.player2;

    // Serve tracker: each player serves 2 points in a row, then it switches.
    const { server: currentServer } = getServeInfo(currentSetScore, firstServer);

    const panel1Tint = panelTint(player1Color);
    const panel2Tint = panelTint(player2Color);

    return (
      <div className="text-black px-2 pb-2 pt-0 sm:px-4 sm:pb-4">
        <div className="max-w-md mx-auto">
          {restoredOtherMatch && (
            <div className="mb-3 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg text-sm">
              This is an earlier match of {context.playerName(player1)} against {context.playerName(player2)} that is
              not saved. Save it or cancel it before you start a new match.
            </div>
          )}
          {storageFailed && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              This device cannot store the match. If you leave this page, the match is lost.
            </div>
          )}
          <div className="bg-white rounded-xl shadow-lg p-3 tall:p-4 sm:p-4 mb-3">
            <div className="text-center mb-2 tall:mb-3">
              <div className="flex justify-center items-center gap-3 xs:gap-6">
                <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                  <ProfilePicture playerId={player1} size={40} border={2} />
                  <span className="font-bold text-xs truncate max-w-full" style={textOn(player1Color, CARD_SURFACE)}>
                    {context.playerName(player1)}
                  </span>
                </div>

                {/* Big numbers are sets, the small ones under them are the points
                    of the set being played. */}
                <div className="flex flex-col items-center bg-gray-50 px-3 py-1 rounded-xl shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black">{matchData.setsWon.player1}</span>
                    <span className="font-bold text-xl">-</span>
                    <span className="text-3xl font-black">{matchData.setsWon.player2}</span>
                  </div>
                  <div className="text-xs font-bold text-gray-500 leading-none pb-0.5">
                    ({currentSetScore.player1}-{currentSetScore.player2})
                  </div>
                </div>

                <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                  <ProfilePicture playerId={player2} size={40} border={2} />
                  <span className="font-bold text-xs truncate max-w-full" style={textOn(player2Color, CARD_SURFACE)}>
                    {context.playerName(player2)}
                  </span>
                </div>
              </div>
              {/* Set number and serve tracker share one row to save height */}
              <div className="mt-2 tall:mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold">
                  Set {(matchData.setPoints?.length || 0) + 1}
                </h2>
                <ServeTrackerDisplay
                  currentSet={currentSetScore}
                  firstServer={firstServer}
                  player1Name={context.playerName(player1)}
                  player2Name={context.playerName(player2)}
                  player1Color={player1Color}
                  player2Color={player2Color}
                  onSelectFirstServer={setFirstServer}
                />
              </div>
              {/* Which side of the table the players have this set */}
              <div className="mt-1.5 tall:mt-2">
                <TableSideDisplay
                  currentSet={currentSetScore}
                  badSide={badSide}
                  player1Name={context.playerName(player1)}
                  player2Name={context.playerName(player2)}
                  player1Color={player1Color}
                  player2Color={player2Color}
                  onSelect={setBadSide}
                />
              </div>
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-2 gap-2 tall:gap-3 mb-2 tall:mb-3">
              {/* Player 1 */}
              <div className="rounded-lg p-2 tall:p-3" style={{ backgroundColor: panel1Tint }}>
                <h3 className="text-sm font-semibold text-gray-700 mb-0.5 tall:mb-1 text-center truncate">
                  {currentServer === 1 && <span className="mr-1">🏓</span>}
                  {context.playerName(player1)}
                </h3>
                <div className="flex flex-col items-center justify-center gap-1.5 tall:gap-2">
                  <div
                    className="text-5xl tall:text-6xl font-bold text-center"
                    style={textOn(player1Color, panel1Tint)}
                  >
                    {currentSetScore.player1}
                  </div>
                  <div className="flex flex-col gap-1.5 tall:gap-2 w-full items-center">
                    <button
                      onClick={() => addPoint(1)}
                      disabled={locked}
                      className="w-full h-24 tall:h-32 text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player1Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(1)}
                      disabled={locked || currentSetScore.player1 === 0}
                      className={classNames(
                        "w-full h-11 tall:h-12 text-center rounded-lg transition text-2xl font-bold",
                        currentSetScore.player1 === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "hover:brightness-95",
                      )}
                      style={currentSetScore.player1 === 0 ? undefined : softFill(player1Color)}
                    >
                      -
                    </button>
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div className="rounded-lg p-2 tall:p-3" style={{ backgroundColor: panel2Tint }}>
                <h3 className="text-sm font-semibold text-gray-700 mb-0.5 tall:mb-1 text-center truncate">
                  {currentServer === 2 && <span className="mr-1">🏓</span>}
                  {context.playerName(player2)}
                </h3>
                <div className="flex flex-col items-center justify-center gap-1.5 tall:gap-2">
                  <div
                    className="text-5xl tall:text-6xl font-bold text-center"
                    style={textOn(player2Color, panel2Tint)}
                  >
                    {currentSetScore.player2}
                  </div>
                  <div className="flex flex-col gap-1.5 tall:gap-2 w-full items-center">
                    <button
                      onClick={() => addPoint(2)}
                      disabled={locked}
                      className="w-full h-24 tall:h-32 text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player2Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(2)}
                      disabled={locked || currentSetScore.player2 === 0}
                      className={classNames(
                        "w-full h-11 tall:h-12 text-center rounded-lg transition text-2xl font-bold",
                        currentSetScore.player2 === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "hover:brightness-95",
                      )}
                      style={currentSetScore.player2 === 0 ? undefined : softFill(player2Color)}
                    >
                      -
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Set Won Button */}
            <button
              onClick={() => setLeader && setWon(setLeader)}
              disabled={locked || setLeader === null}
              className={classNames(
                "w-full py-2.5 tall:py-3 mb-2 rounded-lg font-semibold transition text-base",
                setLeader === null ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "hover:brightness-95",
              )}
              style={setLeader === null ? undefined : fill(setLeaderColor)}
            >
              {setLeader === null
                ? "Set Won by leading player"
                : `Set Won by ${context.playerName(setLeader === 1 ? player1 : player2)}`}
            </button>

            {/* End Match Button */}
            <button
              onClick={endMatch}
              disabled={!canEndMatch || isSaving}
              className={classNames(
                "w-full py-2.5 tall:py-3 rounded-lg font-semibold transition text-base",
                canEndMatch
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed",
              )}
            >
              <div>{isSaving ? "Saving…" : pendingSave ? "Save again" : "End Match & Save"}</div>
              {pendingSave && !isSaving && (
                <div className="text-xs font-normal mt-1">The game is not saved. Scoring is locked.</div>
              )}
              {!canEndMatch && (
                <div className="text-xs font-normal mt-1">
                  {matchData.setsWon.player1 === matchData.setsWon.player2
                    ? "Resolve tie before ending match"
                    : "Complete the set before ending match"}
                </div>
              )}
            </button>
          </div>

          {validationError && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          {/* Live Win Prediction */}
          <div className="mb-3">
            <LiveGamePredictionCard
              player1Id={player1!}
              player2Id={player2!}
              player1Name={context.playerName(player1)}
              player2Name={context.playerName(player2)}
              setsWon={matchData.setsWon}
              currentSet={currentSetScore}
              completedSets={matchData.setPoints ?? []}
              bestOf={DEFAULT_BEST_OF}
            />
          </div>

          {/* Sets History */}
          {matchData.setPoints && matchData.setPoints.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-2">Completed Sets</h3>
              <div className="space-y-2">
                {matchData.setPoints.map((set, index) => {
                  const setWinner = set.player1 > set.player2 ? 1 : 2;
                  const sideLabel = badSideLabel(
                    matchData.badSides[index],
                    context.playerName(player1),
                    context.playerName(player2),
                  );
                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-700">Set {index + 1}</span>
                        {sideLabel && <span className="text-xs text-gray-400">😵 {sideLabel}</span>}
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

          {/* Hand the match over to the broadcasted live game */}
          {isAdmin && (
            <button
              onClick={convertToBroadcastedLiveGame}
              disabled={updateLiveGame.isPending || locked}
              className="w-full mt-3 py-3 px-4 rounded-lg bg-secondary-background text-secondary-text hover:opacity-80 transition-opacity disabled:opacity-50"
            >
              <div className="font-semibold">
                {updateLiveGame.isPending ? "Starting broadcast…" : "📺 Convert to broadcasted live game"}
              </div>
              <div className="text-sm opacity-80 mt-0.5">
                Keeps the score so far and continues on the live game admin page
              </div>
            </button>
          )}

          <button
            onClick={cancelMatch}
            disabled={isSaving}
            className="w-full mt-3 py-3 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ❌ Cancel match
          </button>
        </div>
      </div>
    );
  }

  return null;
};
