import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PillSelect } from "../../common/pill-select";
import { getRangeCutoff, TimeRange, TIME_RANGE_LABELS, TIME_RANGES } from "../../common/time-range";
import { fmtNum } from "../../common/number-utils";
import { ContentCard } from "../player/content-card";
import { durationString, gapString } from "../game/game-tracking-stats";
import { NotEnoughGames, ShareBar, StatTile, StatTileRow } from "./stat-tile";
import { ACCENT_COLOR, AXIS_COLOR, percentTick, SERIES_COLOR, TooltipCard } from "./percent-chart";
import { detailLevels, paceAndServe, scoreShape, trackedShareTrend } from "./statistics-aggregations";

const RANGE_OPTIONS = TIME_RANGES.map((range) => ({ value: range, label: TIME_RANGE_LABELS[range] }));

const formatMonth = (key: string): string => {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

export const GamesTab: React.FC<{ range: TimeRange; setRange: (range: TimeRange) => void }> = ({ range, setRange }) => {
  const context = useEventDbContext();

  const gamesInRange = useMemo(() => {
    const cutoff = getRangeCutoff(range, new Date());
    return context.games.filter((game) => game.playedAt >= cutoff);
  }, [context, range]);

  const detail = useMemo(() => detailLevels(gamesInRange), [gamesInRange]);
  const shape = useMemo(() => scoreShape(gamesInRange), [gamesInRange]);
  const pace = useMemo(() => paceAndServe(gamesInRange), [gamesInRange]);
  const trend = useMemo(() => trackedShareTrend(context.games), [context]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <PillSelect label="Period" options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </div>

      <ContentCard
        title="How much detail we record"
        description="Every game records a winner. These are the shares that also record more. Each level needs the one above it."
      >
        {detail === undefined ? (
          <NotEnoughGames />
        ) : (
          <div className="flex flex-col gap-3">
            <ShareBar label="Sets recorded" share={detail.withSets} />
            <ShareBar label="Points of each set recorded" share={detail.withPoints} />
            <ShareBar
              label="Tracked point by point"
              share={detail.tracked}
              description={`${detail.trackedOnLiveScreen}% of the tracked games were logged on the live screen.`}
            />
          </div>
        )}
      </ContentCard>

      <ContentCard title="Tracked games over time" description="Share of the games of each month that record every point.">
        {trend.length === 0 ? (
          <NotEnoughGames />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
              <XAxis
                dataKey="period"
                stroke={AXIS_COLOR}
                tick={{ fontSize: 11 }}
                tickFormatter={formatMonth}
                angle={-45}
                textAnchor="end"
                height={70}
              />
              <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <TooltipCard title={formatMonth(String(label))}>
                      <p>{payload[0].value}% tracked</p>
                    </TooltipCard>
                  );
                }}
              />
              <Line type="monotone" dataKey="share" stroke={SERIES_COLOR} strokeWidth={3} dot={false} activeDot={{ r: 5, fill: ACCENT_COLOR }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ContentCard>

      <ContentCard title="What the scores look like" description="From the games that record sets and points.">
        {shape === undefined ? (
          <NotEnoughGames what="games with sets" />
        ) : (
          <StatTileRow>
            <StatTile label="Loser won no set" value={`${shape.whitewash}%`} note="of games with sets" />
            <StatTile
              label="Sets that reach deuce"
              value={shape.setsToDeuce === undefined ? "–" : `${shape.setsToDeuce}%`}
              note="both players at 10 or more"
            />
            <StatTile
              label="Median points in a set"
              value={fmtNum(shape.medianPointsPerSet, { digits: 1 }) ?? "–"}
            />
            <StatTile
              label="Median winning margin"
              value={fmtNum(shape.medianSetMargin, { digits: 1 }) ?? "–"}
              note="points in a set"
            />
          </StatTileRow>
        )}
      </ContentCard>

      <ContentCard
        title="Pace and serve"
        description="From the tracked games only, which are the games that record the time of every point."
      >
        {pace === undefined ? (
          <NotEnoughGames what="tracked games" />
        ) : (
          <StatTileRow>
            <StatTile label="Median game length" value={durationString(pace.medianGameDurationMs)} />
            <StatTile label="Median time per point" value={gapString(pace.medianPointGapMs)} />
            <StatTile label="Points won by the server" value={`${pace.pointsWonOnServe}%`} />
            <StatTile label="Median points in a game" value={fmtNum(pace.medianPointsPerGame, { digits: 0 }) ?? "–"} />
          </StatTileRow>
        )}
      </ContentCard>
    </div>
  );
};
