import React from "react";
import { GameScore, GameTracking } from "../../client/client-db/event-store/event-types";
import { clockTimeString } from "../../common/date-utils";
import { badSideName } from "../../common/table-sides";
import { fmtNum } from "../../common/number-utils";
import { durationString, gameTimingStats, longestStreaks, serveStats, setBreakdown } from "./game-tracking-stats";

/**
 * The timeline and serve data of a tracked game. The gaps are the time between
 * two points being registered, so they include everything that happens between
 * the rallies, not the rally alone.
 */
export const TrackingStats: React.FC<{
  tracking: GameTracking;
  pointSequences: string[];
  winnerName: string;
  loserName: string;
}> = ({ tracking, pointSequences, winnerName, loserName }) => {
  const timing = gameTimingStats(tracking);
  const serves = serveStats(pointSequences, tracking);
  const streaks = longestStreaks(pointSequences);
  const servePercent = (side: { served: number; won: number }) =>
    side.served === 0 ? "–" : `${fmtNum((side.won / side.served) * 100)}%`;

  return (
    <div className="rounded-lg bg-secondary-background text-secondary-text p-3">
      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-center">
        <StatCell label="Duration" value={durationString(timing.durationMs)} />
        <StatCell label="Started" value={clockTimeString(tracking.startedAt)} />
      </div>

      {/* Per player: points won on their own serve, and their longest run */}
      <div className="mt-3 pt-3 border-t border-secondary-text/20 grid grid-cols-2 gap-y-2 gap-x-3 text-center">
        <StatCell label={`${winnerName} on serve`} value={servePercent(serves.winner)} />
        <StatCell label={`${loserName} on serve`} value={servePercent(serves.loser)} />
        <StatCell label={`${winnerName} best run`} value={`${streaks.winner} points`} />
        <StatCell label={`${loserName} best run`} value={`${streaks.loser} points`} />
      </div>

      {tracking.corrections > 0 && (
        <p className="mt-3 text-xs opacity-70 text-center">
          {tracking.corrections} {tracking.corrections === 1 ? "point was" : "points were"} undone while tracking, so
          the times are less exact.
        </p>
      )}
    </div>
  );
};

/**
 * Every set of a tracked game: the score, who served the first point, who had
 * the bad side of the table, and how long the set took.
 */
export const SetBreakdownTable: React.FC<{
  tracking: GameTracking;
  pointSequences: string[];
  gameWinnerSides: GameScore["data"]["gameWinnerSides"];
  winnerName: string;
  loserName: string;
}> = ({ tracking, pointSequences, gameWinnerSides, winnerName, loserName }) => {
  const sets = setBreakdown(pointSequences, tracking, gameWinnerSides);
  if (sets.length === 0) return null;
  // Games tracked before the sides were recorded have no side column at all.
  const hasSides = sets.some((set) => set.winnerSide !== undefined);

  return (
    <div className="rounded-lg bg-secondary-background text-secondary-text p-3 overflow-x-auto">
      <h2 className="text-sm font-semibold mb-2">Set by set</h2>
      <table className="w-full text-xs md:text-sm">
        <thead className="opacity-70">
          <tr className="text-left">
            <th className="font-normal pb-1 pr-2">Set</th>
            <th className="font-normal pb-1 pr-2">Score</th>
            <th className="font-normal pb-1 pr-2 whitespace-nowrap">First serve</th>
            {hasSides && <th className="font-normal pb-1 pr-2 whitespace-nowrap">Bad side</th>}
            <th className="font-normal pb-1 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set) => (
            <tr key={set.set} className="border-t border-secondary-text/20">
              <td className="py-1.5 pr-2">{set.set}</td>
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                <SetScore gameWinner={set.points.winner} gameLoser={set.points.loser} />
              </td>
              <td className="py-1.5 pr-2 truncate max-w-[8rem]">{set.firstServer === "W" ? winnerName : loserName}</td>
              {hasSides && (
                <td className="py-1.5 pr-2 truncate max-w-[8rem]">
                  {set.winnerSide ? badSideName(set.winnerSide, winnerName, loserName) : "–"}
                </td>
              )}
              <td className="py-1.5 text-right whitespace-nowrap">{durationString(set.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Every set of a game that records the sides but has no tracking data: who had
 * the bad side of the table, and the score of the set when the game records
 * its set points. A game entered by hand can record the sides with only the
 * sets won, so the score column is there only when there is a score to show.
 */
export const SetSidesTable: React.FC<{
  gameWinnerSides: NonNullable<GameScore["data"]["gameWinnerSides"]>;
  setPoints: GameScore["data"]["setPoints"];
  winnerName: string;
  loserName: string;
}> = ({ gameWinnerSides, setPoints, winnerName, loserName }) => {
  const hasPoints = setPoints !== undefined;

  return (
    <div className="rounded-lg bg-secondary-background text-secondary-text p-3 overflow-x-auto">
      <h2 className="text-sm font-semibold mb-2">Set by set</h2>
      <table className="w-full text-xs md:text-sm">
        <thead className="opacity-70">
          <tr className="text-left">
            <th className="font-normal pb-1 pr-2">Set</th>
            {hasPoints && <th className="font-normal pb-1 pr-2">Score</th>}
            <th className="font-normal pb-1 whitespace-nowrap">Bad side</th>
          </tr>
        </thead>
        <tbody>
          {gameWinnerSides.map((side, index) => (
            <tr key={index} className="border-t border-secondary-text/20">
              <td className="py-1.5 pr-2">{index + 1}</td>
              {hasPoints && (
                <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                  {setPoints[index] ? (
                    <SetScore gameWinner={setPoints[index].gameWinner} gameLoser={setPoints[index].gameLoser} />
                  ) : (
                    "–"
                  )}
                </td>
              )}
              <td className="py-1.5 truncate max-w-[8rem]">{side ? badSideName(side, winnerName, loserName) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * A set score with the trophy on the side of the player who won the set. Both
 * sides reserve the trophy's width, so the score digits line up between rows
 * whether a trophy is there or not.
 */
const SetScore: React.FC<{ gameWinner: number; gameLoser: number }> = ({ gameWinner, gameLoser }) => (
  <span className="inline-flex items-center gap-1">
    <span className="inline-block w-[1.5em] text-right">{gameWinner > gameLoser ? "🏆" : ""}</span>
    <span>
      {gameWinner}-{gameLoser}
    </span>
    <span className="inline-block w-[1.5em] text-left">{gameLoser > gameWinner ? "🏆" : ""}</span>
  </span>
);

const StatCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center min-w-0">
    <span className="text-xs opacity-70 truncate max-w-full">{label}</span>
    <span className="text-lg font-bold truncate max-w-full">{value}</span>
  </div>
);
