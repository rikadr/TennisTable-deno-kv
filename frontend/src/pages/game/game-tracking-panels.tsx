import React from "react";
import { GameScore, GameTracking } from "../../client/client-db/event-store/event-types";
import { clockTimeString } from "../../common/date-utils";
import { badSideName } from "../../common/table-sides";
import { fmtNum } from "../../common/number-utils";
import {
  durationString,
  gameTimingStats,
  gapString,
  longestStreaks,
  serveStats,
  setBreakdown,
} from "./game-tracking-stats";

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2 gap-x-3 text-center">
        <StatCell label="Duration" value={durationString(timing.durationMs)} />
        <StatCell label="Started" value={clockTimeString(tracking.startedAt)} />
        <StatCell label="Between points" value={gapString(timing.averagePointGapMs)} />
        <StatCell label="Longest pause" value={gapString(timing.longestPointGapMs)} />
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
 * the bad side of the table, how long the set took, and the break before it
 * started.
 */
export const SetBreakdownTable: React.FC<{
  tracking: GameTracking;
  pointSequences: string[];
  setPoints: GameScore["data"]["setPoints"];
  winnerName: string;
  loserName: string;
}> = ({ tracking, pointSequences, setPoints, winnerName, loserName }) => {
  const sets = setBreakdown(pointSequences, tracking, setPoints);
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
            <th className="font-normal pb-1 pr-2 text-right">Time</th>
            <th className="font-normal pb-1 pr-2 text-right">Break</th>
            {/* The game's longest pause is in the card above, so a narrow
                screen can drop the per-set one and keep the table unclipped. */}
            <th className="font-normal pb-1 text-right whitespace-nowrap hidden sm:table-cell">Longest pause</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set) => (
            <tr key={set.set} className="border-t border-secondary-text/20">
              <td className="py-1.5 pr-2">{set.set}</td>
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                {set.points.winner}-{set.points.loser} {set.wonByGameWinner ? "🏆" : ""}
              </td>
              <td className="py-1.5 pr-2 truncate max-w-[8rem]">
                {set.firstServer === "W" ? winnerName : loserName}
              </td>
              {hasSides && (
                <td className="py-1.5 pr-2 truncate max-w-[8rem]">
                  {set.winnerSide ? badSideName(set.winnerSide, winnerName, loserName) : "–"}
                </td>
              )}
              <td className="py-1.5 pr-2 text-right whitespace-nowrap">{durationString(set.durationMs)}</td>
              <td className="py-1.5 pr-2 text-right whitespace-nowrap">{gapString(set.breakBeforeMs)}</td>
              <td className="py-1.5 text-right whitespace-nowrap hidden sm:table-cell">
                {gapString(set.longestPointGapMs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs opacity-70">
        The score is from the game winner's side. The break is the time before the first point of the set — for set 1,
        the time from the start of tracking.
        {hasSides && " The bad side is the worse side of the table, and \"Equal\" means the 2 sides are equally good."}
      </p>
    </div>
  );
};

/**
 * Every set of a game that records the sides but has no tracking data: the
 * score and who had the bad side of the table. A game entered by hand can
 * record the sides next to its set points, and this is all it knows per set.
 */
export const SetSidesTable: React.FC<{
  setPoints: NonNullable<GameScore["data"]["setPoints"]>;
  winnerName: string;
  loserName: string;
}> = ({ setPoints, winnerName, loserName }) => {
  if (setPoints.every((set) => set.gameWinnerSide === undefined)) return null;

  return (
    <div className="rounded-lg bg-secondary-background text-secondary-text p-3 overflow-x-auto">
      <h2 className="text-sm font-semibold mb-2">Set by set</h2>
      <table className="w-full text-xs md:text-sm">
        <thead className="opacity-70">
          <tr className="text-left">
            <th className="font-normal pb-1 pr-2">Set</th>
            <th className="font-normal pb-1 pr-2">Score</th>
            <th className="font-normal pb-1 whitespace-nowrap">Bad side</th>
          </tr>
        </thead>
        <tbody>
          {setPoints.map((set, index) => (
            <tr key={index} className="border-t border-secondary-text/20">
              <td className="py-1.5 pr-2">{index + 1}</td>
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                {set.gameWinner}-{set.gameLoser} {set.gameWinner > set.gameLoser ? "🏆" : ""}
              </td>
              <td className="py-1.5 truncate max-w-[8rem]">
                {set.gameWinnerSide ? badSideName(set.gameWinnerSide, winnerName, loserName) : "–"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs opacity-70">
        The score is from the game winner's side. The bad side is the worse side of the table, and "Equal" means the 2
        sides are equally good.
      </p>
    </div>
  );
};

const StatCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col items-center min-w-0">
    <span className="text-xs opacity-70 truncate max-w-full">{label}</span>
    <span className="text-lg font-bold truncate max-w-full">{value}</span>
  </div>
);
