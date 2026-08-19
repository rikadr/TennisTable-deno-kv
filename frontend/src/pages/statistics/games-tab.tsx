import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PillSelect } from "../../common/pill-select";
import { getRangeCutoff, TimeRange, TIME_RANGE_LABELS, TIME_RANGES } from "../../common/time-range";
import { fmtNum } from "../../common/number-utils";
import { ContentCard } from "../player/content-card";
import { durationString, gapString } from "../game/game-tracking-stats";
import { NotEnoughGames, StatTile, StatTileRow } from "./stat-tile";
import { DetailLevelSection } from "./detail-level-section";
import { ACCENT_COLOR, AXIS_COLOR, percentLabel, percentTick, SERIES_COLOR, TooltipCard } from "./percent-chart";
import {
  detailLevels,
  gameLevelStats,
  pointLevelStats,
  setLevelStats,
  trackedLevelStats,
  trackedShareTrend,
} from "./statistics-aggregations";

const RANGE_OPTIONS = TIME_RANGES.map((range) => ({ value: range, label: TIME_RANGE_LABELS[range] }));

const formatMonth = (key: string): string => {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

/** A share that a period can leave undefined, because it has no game for it. */
const shareLabel = (share: number | undefined): string => (share === undefined ? "–" : percentLabel(share));

export const GamesTab: React.FC<{ range: TimeRange; setRange: (range: TimeRange) => void }> = ({ range, setRange }) => {
  const context = useEventDbContext();

  const gamesInRange = useMemo(() => {
    const cutoff = getRangeCutoff(range, new Date());
    return context.games.filter((game) => game.playedAt >= cutoff);
  }, [context, range]);

  const detail = useMemo(() => detailLevels(gamesInRange), [gamesInRange]);
  const gameLevel = useMemo(() => gameLevelStats(gamesInRange), [gamesInRange]);
  const setLevel = useMemo(() => setLevelStats(gamesInRange), [gamesInRange]);
  const pointLevel = useMemo(() => pointLevelStats(gamesInRange), [gamesInRange]);
  const trackedLevel = useMemo(() => trackedLevelStats(gamesInRange), [gamesInRange]);
  const trend = useMemo(() => trackedShareTrend(context.games), [context]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        <PillSelect label="Period" options={RANGE_OPTIONS} value={range} onChange={setRange} />
        <p className="text-sm text-primary-text/70 text-center max-w-xl">
          The sections go from the least detail to the most. Each level needs the level above it, so a section covers
          fewer games than the section over it.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <DetailLevelSection
          level={1}
          title="Game level"
          description="From the winner and the loser only. Every game records this, so these shares cover every game of the period."
        >
          <ContentCard
            title="Rematches and form"
            description="What the results alone say about who meets whom, and who arrives in form."
          >
            {gameLevel === undefined ? (
              <NotEnoughGames />
            ) : (
              <StatTileRow>
                <StatTile
                  label="The pair played before"
                  value={percentLabel(gameLevel.rematchOfThePair)}
                  note="in this period"
                />
                <StatTile
                  label="Rematch within the hour"
                  value={percentLabel(gameLevel.sameSession)}
                  note="the pair also played in the hour before"
                />
                <StatTile
                  label="The loser of the last game wins"
                  value={shareLabel(gameLevel.revenge)}
                  note="of the games the pair played before"
                />
                <StatTile
                  label="The winner won their last game"
                  value={shareLabel(gameLevel.winnerWonThePreviousGame)}
                  note="of the winners who played before"
                />
              </StatTileRow>
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={2}
          title="Set level"
          description="From the games that record how many sets each player won."
          coverage={{ label: "Games that record sets", share: detail?.withSets ?? 0 }}
        >
          <ContentCard title="How the sets fall" description="From the games with sets.">
            {setLevel === undefined ? (
              <NotEnoughGames what="games with sets" />
            ) : (
              <StatTileRow>
                <StatTile label="Loser won no set" value={percentLabel(setLevel.whitewash)} />
                <StatTile
                  label="The last set decided it"
                  value={percentLabel(setLevel.decider)}
                  note="the loser stopped one set short"
                />
                <StatTile label="Played as a single set" value={percentLabel(setLevel.singleSet)} />
                <StatTile
                  label="Median sets in a game"
                  value={fmtNum(setLevel.medianSetsPlayed, { digits: 1 }) ?? "–"}
                />
              </StatTileRow>
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={3}
          title="Point level"
          description="From the games that record the points of each set."
          coverage={{ label: "Games that record the points of each set", share: detail?.withPoints ?? 0 }}
        >
          <ContentCard title="Inside a set" description="Over every set these games record.">
            {pointLevel === undefined ? (
              <NotEnoughGames what="games with points" />
            ) : (
              <StatTileRow columns={3}>
                <StatTile
                  label="Sets that reach deuce"
                  value={percentLabel(pointLevel.setsToDeuce)}
                  note="both players at 10 or more"
                />
                <StatTile
                  label="Median points in a set"
                  value={fmtNum(pointLevel.medianPointsPerSet, { digits: 1 }) ?? "–"}
                />
                <StatTile
                  label="Median winning margin"
                  value={fmtNum(pointLevel.medianSetMargin, { digits: 1 }) ?? "–"}
                  note="points in a set"
                />
              </StatTileRow>
            )}
          </ContentCard>

          <ContentCard title="Over a whole game" description="The points of every set of a game, added up.">
            {pointLevel === undefined ? (
              <NotEnoughGames what="games with points" />
            ) : (
              <StatTileRow columns={3}>
                <StatTile
                  label="Median points in a game"
                  value={fmtNum(pointLevel.medianPointsPerGame, { digits: 0 }) ?? "–"}
                />
                <StatTile
                  label="Points won by the game winner"
                  value={percentLabel(pointLevel.pointsWonByTheWinner)}
                  note="of all the points played"
                />
                <StatTile
                  label="Won with fewer points"
                  value={percentLabel(pointLevel.wonWithFewerPoints)}
                  note="the loser won more points"
                />
              </StatTileRow>
            )}
          </ContentCard>
        </DetailLevelSection>

        <DetailLevelSection
          level={4}
          title="Fully tracked games"
          description="From the games that record every point as it was scored, with its time and its server."
          coverage={{ label: "Games tracked point by point", share: detail?.tracked ?? 0 }}
        >
          <ContentCard title="Pace" description="How long a tracked game and its points take.">
            {trackedLevel === undefined ? (
              <NotEnoughGames what="tracked games" />
            ) : (
              <StatTileRow>
                <StatTile label="Median game length" value={durationString(trackedLevel.medianGameDurationMs)} />
                <StatTile label="Median time per point" value={gapString(trackedLevel.medianPointGapMs)} />
                <StatTile
                  label="Median break between sets"
                  value={
                    trackedLevel.medianSetBreakMs === undefined ? "–" : gapString(trackedLevel.medianSetBreakMs)
                  }
                />
                <StatTile
                  label="Tracked on the live screen"
                  value={shareLabel(detail?.trackedOnLiveScreen)}
                  note="of the tracked games"
                />
              </StatTileRow>
            )}
          </ContentCard>

          <ContentCard title="Serve and runs" description="What the order of the points shows.">
            {trackedLevel === undefined ? (
              <NotEnoughGames what="tracked games" />
            ) : (
              <StatTileRow columns={3}>
                <StatTile label="Points won by the server" value={percentLabel(trackedLevel.pointsWonOnServe)} />
                <StatTile
                  label="The player who won the last point wins the next"
                  value={percentLabel(trackedLevel.pointAfterAWonPoint)}
                  note="over 50% means points come in runs"
                />
                <StatTile
                  label="The first point of a set wins the set"
                  value={percentLabel(trackedLevel.firstPointWinsTheSet)}
                />
              </StatTileRow>
            )}
          </ContentCard>

          <ContentCard
            title="Tracked games over time"
            description="Share of the games of each month that record every point. The whole history, and not the period."
          >
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
                          <p>{percentLabel(Number(payload[0].value))} tracked</p>
                        </TooltipCard>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="share"
                    stroke={SERIES_COLOR}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 5, fill: ACCENT_COLOR }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ContentCard>
        </DetailLevelSection>
      </div>
    </div>
  );
};
