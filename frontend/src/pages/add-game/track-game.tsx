import React, { useState } from "react";
import { StepSelectPlayers } from "./step-select-players";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useEventMutation } from "../../hooks/use-event-mutation";
import { queryClient } from "../../common/query-client";
import { useNavigate } from "react-router-dom";
import { EventTypeEnum, GameCreated, GameScore } from "../../client/client-db/event-store/event-types";
import { newId } from "../../common/nani-id";
import ConfettiExplosion from "react-confetti-explosion";
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
import { computeLiveWinPrediction } from "../live-game/live-game-win-probability";
import { Predictions } from "../../client/client-db/predictions";
import { WinPercentGraph } from "./win-percent-graph";
import { session } from "../../services/auth";
import { useLiveGameQuery, useUpdateLiveGameMutation } from "../live-game/use-live-game";
import {
  appendPoint,
  emptyTrackedSet,
  removeLastPoint,
  toEventTrackingData,
  TrackedSet,
} from "../../common/point-sequences";

interface SetPoint {
  player1: number;
  player2: number;
}

interface MatchData {
  setsWon: {
    player1: number;
    player2: number;
  };
  setPoints?: SetPoint[];
  /** Points of each completed set, in scoring order, and when each was scored. */
  trackedSets: TrackedSet[];
  /** Who served the first point of each completed set. */
  firstServers: Server[];
  /** Who had the bad side of the table in each completed set. */
  badSides: BadSide[];
}

type Stage = "player-selection" | "scoring" | "summary";

export const TrackGamePage: React.FC = () => {
  const context = useEventDbContext();
  const addEventMutation = useEventMutation();
  const navigate = useNavigate();
  const params = useTennisParams();

  const [stage, setStage] = useState<Stage>("player-selection");
  const [player1, setPlayer1] = useState<string | null>(params.player1);
  const [player2, setPlayer2] = useState<string | null>(params.player2);
  const [matchData, setMatchData] = useState<MatchData>({
    setsWon: { player1: 0, player2: 0 },
    setPoints: [],
    trackedSets: [],
    firstServers: [],
    badSides: [],
  });
  const [currentSetScore, setCurrentSetScore] = useState<SetPoint>({
    player1: 0,
    player2: 0,
  });
  // The points of the current set, in the order they were scored.
  const [currentTrackedSet, setCurrentTrackedSet] = useState<TrackedSet>(emptyTrackedSet);
  const [firstServer, setFirstServer] = useState<Server>(1);
  // Who has the bad side of the table in the set being played. Null until the
  // operator records it, and the sides are only saved when every set has one.
  const [badSide, setBadSide] = useState<BadSide>(null);
  // Epoch ms the match started, when it was ended, and how many points were
  // undone. Saved with the game so its timeline can be replayed.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [corrections, setCorrections] = useState(0);
  // Player 1's live win chance sampled after every point, for the summary graph.
  const [winPercentHistory, setWinPercentHistory] = useState<number[]>([]);
  const [validationError, setValidationError] = useState<string>("");
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);

  // The scoring and summary screens are colour coded per player instead of a fixed
  // blue/purple pair, so each side matches the colour the player has everywhere else.
  const player1Color = stringToColor(player1 || "");
  const player2Color = stringToColor(player2 || "");

  const isAdmin = session.isAuthenticated && session.sessionData?.role === "admin";
  // Only fetched to warn before overwriting a broadcast that is already running.
  const liveGameQuery = useLiveGameQuery({ enabled: isAdmin });
  const updateLiveGame = useUpdateLiveGameMutation();

  // Player 1's match-win chance at a given current-set score, from the same
  // model as the live prediction card below the score buttons.
  const computeWinPercent = (currentSet: SetPoint): number => {
    const direct = context.predictions.getDirectFraction(player1 ?? "", player2 ?? "");
    const oneLayer = context.predictions.getOneLayerFraction(player1 ?? "", player2 ?? "");
    const twoLayer = context.predictions.getTwoLayerFraction(player1 ?? "", player2 ?? "");
    const base = Predictions.combinePrioritizedFractions([direct, oneLayer, twoLayer]);
    return computeLiveWinPrediction({
      preGameWinChance: base.confidence > 0 ? base.fraction : 0.5,
      preGameConfidence: base.confidence,
      setsWon: matchData.setsWon,
      currentSet,
      completedSets: matchData.setPoints ?? [],
    }).player1WinChance;
  };

  const addPoint = (player: number) => {
    const key = `player${player}` as keyof SetPoint;
    const next: SetPoint = { ...currentSetScore, [key]: currentSetScore[key] + 1 };
    setCurrentSetScore(next);
    const at = Date.now();
    setCurrentTrackedSet((prev) => appendPoint(prev, player as 1 | 2, at));
    setWinPercentHistory((prev) => [...prev, computeWinPercent(next)]);
  };

  const removePoint = (player: number) => {
    const key = `player${player}` as keyof SetPoint;
    if (currentSetScore[key] === 0) return;
    const next: SetPoint = { ...currentSetScore, [key]: currentSetScore[key] - 1 };
    setCurrentSetScore(next);
    setCurrentTrackedSet((prev) => removeLastPoint(prev, player as 1 | 2));
    setCorrections((prev) => prev + 1);
    // Undoing a point drops the last 2 samples and appends one for the restored
    // score, so the history keeps one sample per point. Undoing the only point
    // of the match just empties the history.
    setWinPercentHistory((prev) => (prev.length <= 1 ? [] : [...prev.slice(0, -2), computeWinPercent(next)]));
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

  const endMatch = () => {
    setEndedAt(Date.now());
    setStage("summary");
  };

  async function submitGame(winner: string, loser: string) {
    setValidationError("");
    const now = Date.now();
    const gameCreatedEvent: GameCreated = {
      type: EventTypeEnum.GAME_CREATED,
      time: now,
      stream: newId(),
      data: { winner, loser, playedAt: now },
    };

    const validateCreated = context.eventStore.gamesProjector.validateCreateGame(gameCreatedEvent);
    if (validateCreated.valid === false) {
      console.error(validateCreated.message);
      setValidationError(validateCreated.message);
      return;
    }

    // Since our setPoints always have values (never undefined), we consider them all "set"
    // We only send setPoints if we actually recorded them (which we always do in this flow)
    const setPointsForValidation = matchData.setPoints || [];

    // Both are undefined when the tracked points do not line up with the
    // completed sets. They are always saved together.
    const trackingData = toEventTrackingData({
      completedSets: setPointsForValidation,
      trackedSets: matchData.trackedSets,
      firstServers: matchData.firstServers,
      player1IsGameWinner: player1 === winner,
      source: "track-game",
      startedAt,
      endedAt,
      corrections,
    });

    const gameScoreEvent: GameScore = {
      type: EventTypeEnum.GAME_SCORE,
      time: gameCreatedEvent.time + 1,
      stream: gameCreatedEvent.stream,
      data: {
        setsWon: {
          gameWinner: player1 === winner ? matchData.setsWon.player1 : matchData.setsWon.player2,
          gameLoser: player1 === winner ? matchData.setsWon.player2 : matchData.setsWon.player1,
        },
        setPoints:
          setPointsForValidation.length > 0
            ? setPointsForValidation.map((set) => ({
                gameWinner: player1 === winner ? set.player1 : set.player2,
                gameLoser: player1 === winner ? set.player2 : set.player1,
              }))
            : undefined,
        gameWinnerSides: matchData.badSides.some((side) => side !== null)
          ? setPointsForValidation.map((_, index) =>
              gameWinnerSideOfBadSide(matchData.badSides[index] ?? null, player1 === winner ? 1 : 2),
            )
          : undefined,
        pointSequences: trackingData?.pointSequences,
        tracking: trackingData?.tracking,
      },
    };

    const recordScores = gameScoreEvent.data.setsWon.gameWinner > 0 || gameScoreEvent.data.setsWon.gameLoser > 0;
    if (recordScores) {
      const validateScore = context.eventStore.gamesProjector.validateScoreGame(gameScoreEvent);
      if (validateScore.valid === false) {
        console.error(validateScore.message);
        setValidationError(validateScore.message);
        return;
      }
    }

    const isPendingTournamentGame = context.tournaments.findAllPendingGames(winner, loser);

    async function onSuccess() {
      queryClient.invalidateQueries();
      setTimeout(() => {
        navigate(
          isPendingTournamentGame.length > 0
            ? `/tournament?tournament=${isPendingTournamentGame[0].tournament.id}&player1=${isPendingTournamentGame[0].player1}&player2=${isPendingTournamentGame[0].player2}`
            : `/game?time=${now}`,
        );
      }, 2_000);
      setGameSuccessfullyAdded(true);
    }

    if (recordScores) {
      await addEventMutation.mutateAsync(gameCreatedEvent);
      await addEventMutation.mutateAsync(gameScoreEvent, {
        onSuccess,
      });
    } else {
      await addEventMutation.mutateAsync(gameCreatedEvent, {
        onSuccess,
      });
    }
  }

  const confirmMatch = () => {
    if (!player1 || !player2) {
      setValidationError("Both players must be selected");
      return;
    }

    const winner = matchData.setsWon.player1 > matchData.setsWon.player2 ? player1 : player2;
    const loser = matchData.setsWon.player1 > matchData.setsWon.player2 ? player2 : player1;

    submitGame(winner, loser);
  };

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
    navigate("/live-game/admin");
  }

  const cancelMatch = () => {
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
    setEndedAt(null);
    setCorrections(0);
    setWinPercentHistory([]);
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
                      className="w-full h-24 tall:h-32 text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player1Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(1)}
                      disabled={currentSetScore.player1 === 0}
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
                      className="w-full h-24 tall:h-32 text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player2Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(2)}
                      disabled={currentSetScore.player2 === 0}
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
              disabled={setLeader === null}
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
              disabled={!canEndMatch}
              className={classNames(
                "w-full py-2.5 tall:py-3 rounded-lg font-semibold transition text-base",
                canEndMatch
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed",
              )}
            >
              <div>End Match & Review</div>
              {!canEndMatch && (
                <div className="text-xs font-normal mt-1">
                  {matchData.setsWon.player1 === matchData.setsWon.player2
                    ? "Resolve tie before ending match"
                    : "Complete the set before ending match"}
                </div>
              )}
            </button>
          </div>

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
            />
          </div>

          {validationError && (
            <div className="mb-3 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {validationError}
            </div>
          )}

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
              disabled={updateLiveGame.isPending}
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
        </div>
      </div>
    );
  }

  // Summary Screen
  if (stage === "summary") {
    const winner = matchData.setsWon.player1 > matchData.setsWon.player2 ? player1 : player2;

    return (
      <div className="p-2 sm:p-4">
        {gameSuccessfullyAdded && (
          <div className="flex justify-center">
            <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
          </div>
        )}
        <div className="max-w-md mx-auto pt-0 sm:pt-8">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="text-center mb-4">
              <h1 className="text-2xl font-bold text-gray-800 mb-2">🏆 Match Complete!</h1>
              <p className="text-lg text-gray-600 text-center">
                Winner:{" "}
                <span
                  className="font-bold"
                  style={textOn(winner === player1 ? player1Color : player2Color, CARD_SURFACE)}
                >
                  {context.playerName(winner)}
                </span>
              </p>
              <div className="m-auto w-fit">
                <ProfilePicture playerId={winner} size={140} border={8} shape="rounded" />
              </div>
            </div>

            {/* Final Score */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="grid grid-cols-3 items-center text-center">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">{context.playerName(player1)}</h3>
                  <div className="text-4xl font-bold" style={textOn(player1Color, ROW_SURFACE)}>
                    {matchData.setsWon.player1}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-400">-</div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">{context.playerName(player2)}</h3>
                  <div className="text-4xl font-bold" style={textOn(player2Color, ROW_SURFACE)}>
                    {matchData.setsWon.player2}
                  </div>
                </div>
              </div>
            </div>

            {/* Winner's win % point by point */}
            <div className="mb-6">
              <WinPercentGraph
                history={winPercentHistory}
                winnerIsPlayer1={winner === player1}
                winnerName={context.playerName(winner)}
                winnerColor={winner === player1 ? player1Color : player2Color}
                completedSets={matchData.setPoints ?? []}
              />
            </div>

            {/* Set Details */}
            {matchData.setPoints && matchData.setPoints.length > 0 && (
              <div className="mb-4">
                <h3 className="text-base font-bold text-gray-800 mb-2">Set Details</h3>
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

            {/* Validation Error */}
            {validationError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {validationError}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={() => !gameSuccessfullyAdded && confirmMatch()}
                disabled={addEventMutation.isPending}
                className={classNames(
                  "w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-base",
                  addEventMutation.isPending
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700",
                )}
              >
                {addEventMutation.isPending ? "Submitting..." : "✅ Confirm & Save"}
              </button>
              <button
                onClick={() => setStage("scoring")}
                disabled={addEventMutation.isPending}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {"<-"} Back
              </button>
              <button
                onClick={cancelMatch}
                disabled={addEventMutation.isPending}
                className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ❌ Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
