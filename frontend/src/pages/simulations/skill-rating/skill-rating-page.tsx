import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { classNames } from "../../../common/class-names";
import { fmtNum } from "../../../common/number-utils";
import { stringToColor } from "../../../common/string-to-color";
import { relativeTimeString, relativeTimeStringShort } from "../../../common/date-utils";
import { useEventDbContext } from "../../../wrappers/event-db-context";
import { useWhrWorker } from "../../../hooks/use-whr-worker";
import { WhrPlayerCurve } from "../../../client/client-db/whr";
import { ProfilePicture } from "../../player/profile-picture";

/**
 * How far a rating may move in one day, as a standard deviation in Elo points.
 * A high value follows a change in form, and it also follows a run of luck. The
 * points of a curve are then noisy, but the trend of a curve is readable, which
 * is what this page is for.
 */
const DRIFT_PER_DAY = 16;

/** More curves than this make a legend longer than it is useful. */
const MAX_LEGEND_SERIES = 12;

type ChartRow = {
  time: number;
  band?: [number, number];
  [playerId: string]: number | [number, number] | undefined;
};

type PlayerSummary = {
  playerId: string;
  rating: number;
  uncertainty: number;
  lastPlayed: number;
  active: boolean;
  /** Enough games to hold a place on the leaderboard. */
  ranked: boolean;
};

/** Short axis tick. Includes the year only when the range covers more than one. */
function axisTick(time: number, spansYears: boolean): string {
  return new Date(time).toLocaleDateString("nb-NO", {
    day: spansYears ? undefined : "numeric",
    month: "short",
    year: spansYears ? "2-digit" : undefined,
  });
}

function summarize(curve: WhrPlayerCurve, active: boolean, gameLimitForRanked: number): PlayerSummary {
  const last = curve.points[curve.points.length - 1];
  return {
    playerId: curve.playerId,
    rating: last.rating,
    uncertainty: last.uncertainty,
    lastPlayed: last.time,
    active,
    ranked: curve.totalGames >= gameLimitForRanked,
  };
}

export const SkillRatingPage: React.FC = () => {
  const context = useEventDbContext();
  const { width = 0 } = useWindowSize();

  const [showRetired, setShowRetired] = useState(false);
  const [showUnranked, setShowUnranked] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);

  const { result, progress } = useWhrWorker(useMemo(() => ({ driftPerDay: DRIFT_PER_DAY }), []));

  const summaries = useMemo<PlayerSummary[]>(() => {
    if (!result) return [];
    return result.curves
      .map((curve) =>
        summarize(
          curve,
          context.eventStore.playersProjector.getPlayer(curve.playerId)?.active === true,
          context.client.gameLimitForRanked,
        ),
      )
      .sort((a, b) => b.rating - a.rating);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Default to the five highest rated active players, until the user picks
  const activeSelection = useMemo(() => {
    if (selected !== null) return selected;
    return summaries
      .filter((summary) => summary.active && summary.ranked)
      .slice(0, 5)
      .map((summary) => summary.playerId);
  }, [selected, summaries]);

  const curvesById = useMemo(() => new Map((result?.curves ?? []).map((curve) => [curve.playerId, curve])), [result]);

  const chartData = useMemo<ChartRow[]>(() => {
    const rowsByTime = new Map<number, ChartRow>();
    const single = activeSelection.length === 1;

    for (const playerId of activeSelection) {
      const curve = curvesById.get(playerId);
      if (!curve) continue;
      for (const point of curve.points) {
        const row: ChartRow = rowsByTime.get(point.time) ?? { time: point.time };
        row[playerId] = point.rating;
        if (single) {
          row.band = [point.rating - point.uncertainty, point.rating + point.uncertainty];
        }
        rowsByTime.set(point.time, row);
      }
    }

    return Array.from(rowsByTime.values()).sort((a, b) => a.time - b.time);
  }, [activeSelection, curvesById]);

  const spansYears = useMemo(() => {
    if (chartData.length < 2) return false;
    const first = new Date(chartData[0].time).getFullYear();
    const last = new Date(chartData[chartData.length - 1].time).getFullYear();
    return first !== last;
  }, [chartData]);

  const toggle = (playerId: string) =>
    setSelected(() => {
      const current = activeSelection;
      if (current.includes(playerId)) return current.filter((id) => id !== playerId);
      return [...current, playerId];
    });

  if (!result) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-primary-background rounded-lg text-center">
        <h1 className="text-xl md:text-2xl text-primary-text">Skill rating over time</h1>
        <p className="text-primary-text/60 text-sm mt-2 mb-6">Fitting every game in the history…</p>
        <div className="h-2.5 w-full rounded-full bg-primary-text/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-secondary-background transition-all duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <p className="text-primary-text/60 text-xs mt-2">{Math.round(progress * 100)} %</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-12 p-6 bg-primary-background rounded-lg text-center">
        <h1 className="text-xl md:text-2xl text-primary-text">Skill rating over time</h1>
        <p className="text-primary-text/60 text-sm mt-2">No games to rate yet.</p>
      </div>
    );
  }

  const selectable = summaries.filter((summary) => (showRetired || summary.active) && (showUnranked || summary.ranked));

  return (
    <div className="max-w-5xl mx-auto bg-primary-background rounded-lg p-2 md:p-4 text-primary-text">
      <h1 className="text-xl md:text-2xl text-center pt-2">Skill rating over time</h1>
      <p className="text-center text-primary-text/60 text-xs md:text-sm mt-1 mb-4 max-w-2xl mx-auto">
        One skill curve per player, fitted over every game at once. A rating of 1 000 is the skill of a new player, so
        the numbers stay comparable back in time. A win by a large margin moves a rating more than a win by a small
        margin. The rating uses played games only. It does not change when a player retires, and it does not depend on
        who is on the leaderboard today.
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-4">
        <label className="flex items-center gap-2 text-xs md:text-sm text-primary-text/80">
          <input type="checkbox" checked={showUnranked} onChange={(e) => setShowUnranked(e.target.checked)} />
          Include unranked players
        </label>
        <label className="flex items-center gap-2 text-xs md:text-sm text-primary-text/80">
          <input type="checkbox" checked={showRetired} onChange={(e) => setShowRetired(e.target.checked)} />
          Include retired players
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => setSelected(selectable.map((summary) => summary.playerId))}
            className="px-2.5 py-1 rounded text-xs md:text-sm font-medium border border-primary-text/20 hover:bg-secondary-background/50 transition-colors"
          >
            Add all
          </button>
          <button
            onClick={() => setSelected([])}
            className="px-2.5 py-1 rounded text-xs md:text-sm font-medium border border-primary-text/20 hover:bg-secondary-background/50 transition-colors"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={width > 768 ? 400 : 300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 8, left: -14 }}>
          <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" opacity={0.4} />
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(time: number) => axisTick(time, spansYears)}
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            type="number"
            domain={["dataMin - 30", "dataMax + 30"]}
            tickFormatter={(value: number) => fmtNum(value, { digits: 0 }) ?? ""}
            stroke="rgb(var(--color-primary-text))"
            tick={{ fontSize: 11 }}
          />
          <Tooltip animationDuration={0} content={<RatingTooltip />} />
          {activeSelection.length <= MAX_LEGEND_SERIES && (
            <Legend
              formatter={(value: string) => <span className="text-primary-text text-xs md:text-sm">{value}</span>}
              iconType="plainline"
            />
          )}
          <ReferenceLine
            y={1000}
            stroke="rgb(var(--color-primary-text))"
            strokeDasharray="4 4"
            opacity={0.6}
            label={{
              value: "New player",
              position: "insideBottomLeft",
              fill: "rgb(var(--color-primary-text))",
              fontSize: 11,
            }}
          />
          {activeSelection.length === 1 && (
            <Area
              dataKey="band"
              stroke="none"
              fill={stringToColor(activeSelection[0])}
              fillOpacity={0.18}
              legendType="none"
              tooltipType="none"
              connectNulls
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          {activeSelection.map((playerId) => (
            <Line
              key={playerId}
              type="monotone"
              dataKey={playerId}
              name={context.playerName(playerId)}
              stroke={stringToColor(playerId)}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {activeSelection.length === 1 && (
        <p className="text-center text-primary-text/60 text-xs mt-1">
          The band is one standard deviation. It is wide where there are few games.
        </p>
      )}
      {activeSelection.length === 0 && (
        <p className="text-center text-primary-text/60 text-sm mt-2">Select a player below to see a curve.</p>
      )}
      {activeSelection.length > MAX_LEGEND_SERIES && (
        <p className="text-center text-primary-text/60 text-xs mt-1">
          {activeSelection.length} players on the chart. The colour of a row in the table matches its curve.
        </p>
      )}

      {/* Ratings table, which is also the player selection */}
      <div className="mt-4 rounded-lg w-full overflow-hidden">
        <table className="w-full text-primary-text border-collapse text-xs xs:text-sm md:text-base">
          <thead>
            <tr className="text-primary-text">
              <th className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-medium">#</th>
              <th className="py-1 px-1 xs:px-2 md:px-3 text-left w-[50%] max-w-0 font-medium">Player</th>
              <th className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-medium">Rating</th>
              <th className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-light">Uncertainty</th>
              <th className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-light"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-text/50">
            {selectable.map((summary, index) => {
              const isSelected = activeSelection.includes(summary.playerId);
              return (
                <tr
                  key={summary.playerId}
                  data-selected={isSelected}
                  onClick={() => toggle(summary.playerId)}
                  className={classNames(
                    "cursor-pointer transition-colors",
                    isSelected ? "bg-primary-text/10" : "hover:bg-primary-text/5",
                  )}
                >
                  <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-medium">
                    {index + 1}
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 w-[50%] max-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="shrink-0 w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: isSelected ? stringToColor(summary.playerId) : "transparent" }}
                      />
                      <ProfilePicture playerId={summary.playerId} size={24} border={2} shape="rounded" />
                      <span className="truncate">{context.playerName(summary.playerId)}</span>
                      {!summary.active && <span className="shrink-0 text-primary-text/50 text-xs">retired</span>}
                    </div>
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-medium">
                    {fmtNum(summary.rating, { digits: 0 })}
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-light text-primary-text/70">
                    ±{fmtNum(summary.uncertainty, { digits: 0 })}
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap font-light text-primary-text/70">
                    {relativeTimeStringShort(new Date(summary.lastPlayed))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-1 text-xs text-primary-text/60">
        <p>
          The method is Whole History Rating. A result from today also sharpens the estimate of a player months back, so
          a curve can change when new games arrive.
        </p>
        <p>
          A curve follows a change in form closely, so it also follows a run of luck. Read the trend of a curve, not a
          single point. The band of one player shows how exact each point is.
        </p>
        <p>
          The game result decides whether a rating goes up or down. The sets and the points then refine it. A set score
          is recorded on {fmtNum(result.coverage.withSets, { digits: 0 })} of{" "}
          {fmtNum(result.coverage.games, { digits: 0 })} games, and the points of each set on{" "}
          {fmtNum(result.coverage.withPoints, { digits: 0 })}. Games with no score still count in full at the game
          level, so a rating is more exact over the period with recorded scores.
        </p>
      </div>
    </div>
  );
};

const RatingTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload.filter((item) => typeof item.value === "number");
  if (rows.length === 0) return null;

  return (
    <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text text-sm">
      <p className="text-primary-text/70 text-xs mb-1">
        {typeof label === "number" ? relativeTimeString(new Date(label)) : ""}
      </p>
      {rows.map((item) => (
        <p key={item.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          <span>
            {item.name}: {fmtNum(item.value as number, { digits: 0 })}
          </span>
        </p>
      ))}
    </div>
  );
};
