import React, { useState } from "react";
import { StepSelectPlayers } from "../step-select-players";
import { useEventDbContext } from "../../../wrappers/event-db-context";

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
  const [stage, setStage] = useState<Stage>("player-selection");
  const [player1, setPlayer1] = useState<string | null>(null);
  const [player2, setPlayer2] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData>({
    setsWon: { player1: 0, player2: 0 },
    setPoints: [],
  });
  const [currentSetScore, setCurrentSetScore] = useState<SetPoint>({
    player1: 0,
    player2: 0,
  });

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

  const confirmMatch = () => {
    // This is where you'd save the match data
    console.log("Match confirmed:", {
      player1,
      player2,
      matchData,
    });

    // Reset everything
    setStage("player-selection");
    setPlayer1("");
    setPlayer2("");
    setMatchData({
      setsWon: { player1: 0, player2: 0 },
      setPoints: [],
    });
    setCurrentSetScore({ player1: 0, player2: 0 });
  };

  const cancelMatch = () => {
    setStage("player-selection");
    setPlayer1("");
    setPlayer2("");
    setMatchData({
      setsWon: { player1: 0, player2: 0 },
      setPoints: [],
    });
    setCurrentSetScore({ player1: 0, player2: 0 });
  };

  // Player Selection Screen
  if (stage === "player-selection") {
    return (
      <div className="min-h-scre p-4">
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
      <div className="min-h-screen text-black p-4">
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
                      className={`w-12 text-center rounded-lg transition ${
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
                        <span className={`font-bold ${setWinner === 1 ? "text-blue-600" : "text-gray-400"}`}>
                          {set.player1}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className={`font-bold ${setWinner === 2 ? "text-purple-600" : "text-gray-400"}`}>
                          {set.player2}
                        </span>
                        🏆
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
      <div className="min-h-screen p-4">
        <div className="max-w-sm mx-auto pt-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-center mb-6">
              🏆
              <h1 className="text-2xl font-bold text-gray-800 mb-2">Match Complete!</h1>
              <p className="text-lg text-gray-600">
                Winner: <span className="font-bold text-indigo-600">{context.playerName(winner)}</span>
              </p>
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
                  {matchData.setPoints.map((set, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="font-semibold text-gray-700">Set {index + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className={`font-bold ${set.player1 > set.player2 ? "text-blue-600" : "text-gray-400"}`}>
                          {set.player1}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span
                          className={`font-bold ${set.player2 > set.player1 ? "text-purple-600" : "text-gray-400"}`}
                        >
                          {set.player2}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                onClick={confirmMatch}
                className="w-full bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2 text-base"
              >
                ✅ Confirm & Save
              </button>
              <button
                onClick={cancelMatch}
                className="w-full bg-gray-200 text-gray-700 py-4 rounded-lg font-semibold hover:bg-gray-300 transition flex items-center justify-center gap-2 text-base"
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
