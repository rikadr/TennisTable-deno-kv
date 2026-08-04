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
import { LiveGamePredictionCard } from "../live-game/live-game-prediction-card";
import { session } from "../../services/auth";
import { useLiveGameQuery, useUpdateLiveGameMutation } from "../live-game/use-live-game";

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
  });
  const [currentSetScore, setCurrentSetScore] = useState<SetPoint>({
    player1: 0,
    player2: 0,
  });
  const [firstServer, setFirstServer] = useState<Server>(1);
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

  const addPoint = (player: number) => {
    setCurrentSetScore((prev) => ({
      ...prev,
      [`player${player}`]: prev[`player${player}` as keyof SetPoint] + 1,
    }));
  };

  const removePoint = (player: number) => {
    setCurrentSetScore((prev) => ({
      ...prev,
      [`player${player}`]: Math.max(0, prev[`player${player}` as keyof SetPoint] - 1),
    }));
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
    }));

    setCurrentSetScore({ player1: 0, player2: 0 });
    // Alternate who serves first in the next set, per table tennis convention.
    setFirstServer((prev) => (prev === 1 ? 2 : 1));
  };

  const startMatch = () => {
    setStage("scoring");
  };

  const endMatch = () => {
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
            : `/1v1/?player1=${winner}&player2=${loser}`,
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
        firstServer,
        startedAt: now,
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
    });
    setCurrentSetScore({ player1: 0, player2: 0 });
    setFirstServer(1);
    setValidationError("");
  };

  // Player Selection Screen
  if (stage === "player-selection") {
    return (
      <div className="p-4 max-w-xl m-auto">
        {player1 && player2 && (
          <PendingTournamentGame key={`${player1}-${player2}`} player1={player1} player2={player2} />
        )}

        <div className="max-w-sm mx-auto pt-8 space-y-4">
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
      <div className="text-black p-4 pt-0">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="text-center mb-4">
              <h2 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Total Score</h2>
              <div className="flex justify-center items-center gap-6 mb-2">
                <div className="flex flex-col items-center gap-1">
                  <ProfilePicture playerId={player1} size={50} border={2} />
                  <span className="font-bold text-sm" style={textOn(player1Color, CARD_SURFACE)}>
                    {context.playerName(player1)}
                  </span>
                </div>

                {/* Big numbers are sets, the small ones under them are the points
                    of the set being played. */}
                <div className="flex flex-col items-center bg-gray-50 px-4 py-1 rounded-xl shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-black">{matchData.setsWon.player1}</span>
                    <span className="font-bold text-xl">-</span>
                    <span className="text-3xl font-black">{matchData.setsWon.player2}</span>
                  </div>
                  <div className="text-xs font-bold text-gray-500 leading-none pb-0.5">
                    ({currentSetScore.player1}-{currentSetScore.player2})
                  </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <ProfilePicture playerId={player2} size={50} border={2} />
                  <span className="font-bold text-sm" style={textOn(player2Color, CARD_SURFACE)}>
                    {context.playerName(player2)}
                  </span>
                </div>
              </div>
              {/* Set number and serve tracker share one row to save height */}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
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
            </div>

            {/* Score Display */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Player 1 */}
              <div className="rounded-lg p-2" style={{ backgroundColor: panel1Tint }}>
                <h3 className="text-sm font-semibold text-gray-700 mb-1 text-center truncate">
                  {currentServer === 1 && <span className="mr-1">🏓</span>}
                  {context.playerName(player1)}
                </h3>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="text-5xl font-bold text-center" style={textOn(player1Color, panel1Tint)}>
                    {currentSetScore.player1}
                  </div>
                  <div className="flex flex-col gap-2 w-full items-center">
                    <button
                      onClick={() => addPoint(1)}
                      className="w-full max-w-28 aspect-square text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player1Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(1)}
                      disabled={currentSetScore.player1 === 0}
                      className={classNames(
                        "w-full max-w-28 h-12 text-center rounded-lg transition text-2xl font-bold",
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
              <div className="rounded-lg p-2" style={{ backgroundColor: panel2Tint }}>
                <h3 className="text-sm font-semibold text-gray-700 mb-1 text-center truncate">
                  {currentServer === 2 && <span className="mr-1">🏓</span>}
                  {context.playerName(player2)}
                </h3>
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="text-5xl font-bold text-center" style={textOn(player2Color, panel2Tint)}>
                    {currentSetScore.player2}
                  </div>
                  <div className="flex flex-col gap-2 w-full items-center">
                    <button
                      onClick={() => addPoint(2)}
                      className="w-full max-w-28 aspect-square text-center text-4xl font-bold rounded-lg hover:brightness-95 transition"
                      style={fill(player2Color)}
                    >
                      +
                    </button>
                    <button
                      onClick={() => removePoint(2)}
                      disabled={currentSetScore.player2 === 0}
                      className={classNames(
                        "w-full max-w-28 h-12 text-center rounded-lg transition text-2xl font-bold",
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
                "w-full py-3 mb-2 rounded-lg font-semibold transition text-base",
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
                "w-full py-3 rounded-lg font-semibold transition text-base",
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
          <div className="mb-4">
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
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          {/* Sets History */}
          {matchData.setPoints && matchData.setPoints.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-3">Completed Sets</h3>
              <div className="space-y-2">
                {matchData.setPoints.map((set, index) => {
                  const setWinner = set.player1 > set.player2 ? 1 : 2;
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="font-semibold text-gray-700">Set {index + 1}</span>
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
              className="w-full mt-4 py-3 px-4 rounded-lg bg-secondary-background text-secondary-text hover:opacity-80 transition-opacity disabled:opacity-50"
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
      <div className="p-4">
        {gameSuccessfullyAdded && (
          <div className="flex justify-center">
            <ConfettiExplosion particleCount={250} force={0.8} width={2_000} duration={10_000} />
          </div>
        )}
        <div className="max-w-sm mx-auto pt-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              🏆
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Match Complete!</h1>
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
                <ProfilePicture playerId={winner} border={12} shape="rounded" />
              </div>
            </div>

            {/* Final Score */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
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

            {/* Set Details */}
            {matchData.setPoints && matchData.setPoints.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-800 mb-3">Set Details</h3>
                <div className="space-y-2">
                  {matchData.setPoints.map((set, index) => {
                    const setWinner = set.player1 > set.player2 ? 1 : 2;
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <span className="font-semibold text-gray-700">Set {index + 1}</span>
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
            <div className="space-y-3">
              <button
                onClick={() => !gameSuccessfullyAdded && confirmMatch()}
                disabled={addEventMutation.isPending}
                className={classNames(
                  "w-full py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-base",
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
                className="w-full bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {"<-"} Back
              </button>
              <button
                onClick={cancelMatch}
                disabled={addEventMutation.isPending}
                className="w-full bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
