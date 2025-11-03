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
  const [validationError, setValidationError] = useState<string>("");
  const [gameSuccessfullyAdded, setGameSuccessfullyAdded] = useState(false);

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

  const cancelMatch = () => {
    setStage("player-selection");
    setPlayer1(null);
    setPlayer2(null);
    setMatchData({
      setsWon: { player1: 0, player2: 0 },
      setPoints: [],
    });
    setCurrentSetScore({ player1: 0, player2: 0 });
    setValidationError("");
  };

  // Player Selection Screen
  if (stage === "player-selection") {
    return (
      <div className="p-4 max-w-xl m-auto">
        {player1 && player2 && <PendingTournamentGame player1={player1} player2={player2} />}

        <div className="max-w-sm mx-auto pt-8 space-y-4">
          <StepSelectPlayers player1={{ id: player1, set: setPlayer1 }} player2={{ id: player2, set: setPlayer2 }} />
          {player1 && player2 && (
            <button
              onClick={startMatch}
              className="w-full py-3 rounded-lg font-semibold transition text-base bg-blue-500 text-white hover:bg-blue-600"
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
    const player1Leading = currentSetScore.player1 > currentSetScore.player2;
    const player2Leading = currentSetScore.player2 > currentSetScore.player1;
    const isSetEmpty = currentSetScore.player1 === 0 && currentSetScore.player2 === 0;
    const canEndMatch =
      (matchData.setPoints?.length || 0) > 0 && isSetEmpty && matchData.setsWon.player1 !== matchData.setsWon.player2;

    return (
      <div className="text-black p-4">
        <div className="max-w-sm mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 mb-3">Set {(matchData.setPoints?.length || 0) + 1}</h2>
              <div className="flex justify-center items-center gap-3 text-sm">
                <span className="bg-blue-100 px-3 py-1 rounded-full font-medium">
                  {context.playerName(player1)}: {matchData.setsWon.player1}
                </span>
                <span className="bg-purple-100 px-3 py-1 rounded-full font-medium">
                  {context.playerName(player2)}: {matchData.setsWon.player2}
                </span>
              </div>
            </div>

            {/* Score Display */}
            <div className="space-y-4 mb-4">
              {/* Player 1 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-base font-semibold text-gray-700 mb-3">{context.playerName(player1)}</h3>
                <div className="flex items-center justify-between">
                  <div className="text-5xl font-bold text-blue-600">{currentSetScore.player1}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => removePoint(1)}
                      disabled={currentSetScore.player1 === 0}
                      className={`w-12 text-center p-3 rounded-lg transition ${
                        currentSetScore.player1 === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-400 text-white hover:bg-blue-500"
                      }`}
                    >
                      -
                    </button>
                    <button
                      onClick={() => addPoint(1)}
                      className="w-12 text-center bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Player 2 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-base font-semibold text-gray-700 mb-3">{context.playerName(player2)}</h3>
                <div className="flex items-center justify-between">
                  <div className="text-5xl font-bold text-purple-600">{currentSetScore.player2}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => removePoint(2)}
                      disabled={currentSetScore.player2 === 0}
                      className={`w-12 text-center p-3 rounded-lg transition ${
                        currentSetScore.player2 === 0
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-purple-400 text-white hover:bg-purple-500"
                      }`}
                    >
                      -
                    </button>
                    <button
                      onClick={() => addPoint(2)}
                      className="w-12 text-center bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Set Won Buttons */}
            <div className="space-y-2 mb-3">
              <button
                onClick={() => setWon(1)}
                disabled={!player1Leading}
                className={`w-full py-3 rounded-lg font-semibold transition text-base ${
                  player1Leading
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Set Won by {context.playerName(player1)}
              </button>
              <button
                onClick={() => setWon(2)}
                disabled={!player2Leading}
                className={`w-full py-3 rounded-lg font-semibold transition text-base ${
                  player2Leading
                    ? "bg-purple-500 text-white hover:bg-purple-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Set Won by {context.playerName(player2)}
              </button>
            </div>

            {/* End Match Button */}
            <button
              onClick={endMatch}
              disabled={!canEndMatch}
              className={`w-full py-3 rounded-lg font-semibold transition text-base ${
                canEndMatch
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
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

          {/* Sets History */}
          {matchData.setPoints && matchData.setPoints.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h3 className="text-base font-bold text-gray-800 mb-3">Completed Sets</h3>
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
                            className={classNames("font-bold", setWinner === 1 ? "text-blue-600" : "text-gray-400")}
                          >
                            {set.player1}
                          </span>
                          <span className="text-gray-400">-</span>
                          <span
                            className={classNames("font-bold", setWinner === 2 ? "text-purple-600" : "text-gray-400")}
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
                Winner: <span className="font-bold text-indigo-600">{context.playerName(winner)}</span>
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
                  <div className="text-4xl font-bold text-blue-600">{matchData.setsWon.player1}</div>
                </div>
                <div className="text-2xl font-bold text-gray-400">-</div>
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2 text-sm">{context.playerName(player2)}</h3>
                  <div className="text-4xl font-bold text-purple-600">{matchData.setsWon.player2}</div>
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
                              className={classNames("font-bold", setWinner === 1 ? "text-blue-600" : "text-gray-400")}
                            >
                              {set.player1}
                            </span>
                            <span className="text-gray-400">-</span>
                            <span
                              className={classNames("font-bold", setWinner === 2 ? "text-purple-600" : "text-gray-400")}
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
                className={`w-full py-4 rounded-lg font-semibold transition flex items-center justify-center gap-2 text-base ${
                  addEventMutation.isPending
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                }`}
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
