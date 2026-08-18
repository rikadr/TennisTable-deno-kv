import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { PillSelect } from "../../common/pill-select";
import { fmtNum } from "../../common/number-utils";
import { ContentCard } from "../player/content-card";
import { NotEnoughGames, StatTile, StatTileRow } from "./stat-tile";
import { ACCENT_COLOR, AXIS_COLOR, percentLabel, percentTick, SERIES_COLOR, TooltipCard } from "./percent-chart";
import { GAP_GROUP_SIZE, GapView, MIN_GAMES_PER_BUCKET, ratingGapDistribution, upsetRate } from "./statistics-aggregations";

const VIEW_OPTIONS: { value: GapView; label: string }[] = [
  { value: "all", label: "All" },
  { value: "wins", label: "Wins" },
  { value: "losses", label: "Losses" },
];

// Each group is measured against the most common one, which reads 100%.
const VIEW_DESCRIPTION: Record<GapView, string> = {
  all: "Every game counts twice, once from each side. A negative gap means the player was the stronger of the two.",
  wins: "The winner's view of each game. A negative gap means the winner beat a stronger player.",
  losses: "The loser's view of each game. A positive gap means the loser lost to a stronger player.",
};

const signedGroup = (group: number): string => `${group > 0 ? "+" : ""}${group}`;

export const MatchupsTab: React.FC<{ view: GapView; setView: (view: GapView) => void }> = ({ view, setView }) => {
  const context = useEventDbContext();

  const gaps = useMemo(
    () => ratingGapDistribution(context.games, context.allPlayers, view),
    [context, view],
  );
  const upsets = useMemo(() => upsetRate(context.games, context.allPlayers), [context]);

  return (
    <div className="flex flex-col gap-4">
      <ContentCard
        title="Rating gap of the matchups"
        description={VIEW_DESCRIPTION[view]}
        action={<PillSelect label="" options={VIEW_OPTIONS} value={view} onChange={setView} />}
      >
        {gaps === undefined ? (
          <NotEnoughGames />
        ) : (
          <div className="flex flex-col gap-3">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gaps.buckets} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
                <XAxis
                  dataKey="gapGroup"
                  stroke={AXIS_COLOR}
                  tick={{ fontSize: 10 }}
                  tickFormatter={signedGroup}
                  interval={Math.max(Math.floor(gaps.buckets.length / 10), 1)}
                />
                <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
                <Tooltip
                  cursor={{ fill: AXIS_COLOR, fillOpacity: 0.1 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0].payload as { gapGroup: number; share: number };
                    return (
                      <TooltipCard
                        title={`${signedGroup(entry.gapGroup - GAP_GROUP_SIZE / 2)} to ${signedGroup(
                          entry.gapGroup + GAP_GROUP_SIZE / 2,
                        )}`}
                      >
                        <p>{percentLabel(entry.share)} of the most common group</p>
                      </TooltipCard>
                    );
                  }}
                />
                <Bar dataKey="share" stroke={ACCENT_COLOR} strokeWidth={1} radius={[2, 2, 0, 0]}>
                  {gaps.buckets.map((bucket) => (
                    // The group that holds the even matchups gets the accent, as
                    // the Opponent scores card on the player page does.
                    <Cell key={bucket.gapGroup} fill={bucket.gapGroup === 0 ? AXIS_COLOR : SERIES_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <StatTileRow>
              <StatTile label="Median gap" value={fmtNum(gaps.medianGap, { digits: 0, signedPositive: true }) ?? "–"} />
              <StatTile label="Average gap" value={fmtNum(gaps.averageGap, { digits: 0, signedPositive: true }) ?? "–"} />
            </StatTileRow>
          </div>
        )}
      </ContentCard>

      <ContentCard
        title="How often the weaker player wins"
        description={`Against what the rating model expects. Gaps with fewer than ${MIN_GAMES_PER_BUCKET} games are left out.`}
      >
        {upsets === undefined || upsets.points.length === 0 ? (
          <NotEnoughGames />
        ) : (
          <div className="flex flex-col gap-3">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={upsets.points} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
                <XAxis
                  dataKey="gapGroup"
                  stroke={AXIS_COLOR}
                  tick={{ fontSize: 11 }}
                  label={{ value: "Rating gap", position: "insideBottom", offset: -12, style: { fill: AXIS_COLOR, fontSize: 11 } }}
                />
                {/* A near even matchup can pass 50%, so the axis holds the whole range. */}
                <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={percentTick} />
                <Legend verticalAlign="top" height={28} iconType="line" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const entry = payload[0].payload as { actual: number; expected: number };
                    return (
                      <TooltipCard title={`${label} to ${Number(label) + GAP_GROUP_SIZE} points apart`}>
                        <p>{percentLabel(entry.actual)} won by the weaker player</p>
                        <p className="opacity-80">{percentLabel(entry.expected)} expected</p>
                      </TooltipCard>
                    );
                  }}
                />
                <Line type="monotone" dataKey="actual" name="Actual" stroke={SERIES_COLOR} strokeWidth={3} dot={{ r: 3 }} />
                <Line
                  type="monotone"
                  dataKey="expected"
                  name="Expected"
                  stroke={ACCENT_COLOR}
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <StatTileRow>
              <StatTile label="Won by the stronger player" value={percentLabel(upsets.favouriteWinRate)} note="of all games" />
            </StatTileRow>
          </div>
        )}
      </ContentCard>
    </div>
  );
};
