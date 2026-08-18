import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ContentCard } from "../player/content-card";
import { NotEnoughGames, ShareBar, StatTile, StatTileRow } from "./stat-tile";
import { ACCENT_COLOR, AXIS_COLOR, percentLabel, percentTick, SERIES_COLOR, TooltipCard } from "./percent-chart";
import {
  CoveragePoint,
  GAP_GROUP_SIZE,
  pairingCoverage,
  rankedMix,
  rankMovement,
  ratingDistribution,
} from "./statistics-aggregations";

const DAY_MS = 24 * 60 * 60 * 1000;
const MOVEMENT_WINDOW_DAYS = 30;

const formatMonth = (key: string): string => {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};

export const LeagueTab: React.FC = () => {
  const context = useEventDbContext();

  const rankedPlayers = useMemo(() => context.leaderboard.getLeaderboard().rankedPlayers, [context]);
  const rankedIds = useMemo(() => new Set(rankedPlayers.map((player) => player.id)), [rankedPlayers]);

  const activeIds = useMemo(() => new Set(context.players.map((player) => player.id)), [context]);

  const ratings = useMemo(() => ratingDistribution(rankedPlayers.map((player) => player.elo)), [rankedPlayers]);
  const coverage = useMemo(
    () => pairingCoverage(context.games, context.events, context.client.gameLimitForRanked),
    [context],
  );
  const mix = useMemo(() => rankedMix(context.games, rankedIds), [context, rankedIds]);
  const movement = useMemo(() => {
    // The cached map holds every player ever created. The leaderboard this tile
    // describes shows the active ones only, so a deactivated player must not
    // take up a place in either ranking.
    const summaries = Array.from(context.leaderboard.getCachedLeaderboardMap().values()).filter((summary) =>
      activeIds.has(summary.id),
    );
    return rankMovement(summaries, Date.now() - MOVEMENT_WINDOW_DAYS * DAY_MS, context.client.gameLimitForRanked);
  }, [context, activeIds]);

  return (
    <div className="flex flex-col gap-4">
      <StatTileRow>
        <StatTile
          label="Of the possible pairs have met"
          value={coverage === undefined ? "–" : percentLabel(coverage.now.all)}
          note="between active players"
        />
        <StatTile
          label="Of the ranked pairs have met"
          value={coverage === undefined ? "–" : percentLabel(coverage.now.ranked)}
          note="between ranked players"
        />
        <StatTile
          label={`Changed place in ${MOVEMENT_WINDOW_DAYS} days`}
          value={movement === undefined ? "–" : percentLabel(movement.moved)}
          note={movement === undefined ? undefined : `${percentLabel(movement.climbed)} up, ${percentLabel(movement.fell)} down`}
        />
      </StatTileRow>

      <ContentCard title="Rating spread" description="Share of the ranked players in each 50 point group.">
        {ratings.length === 0 ? (
          <NotEnoughGames what="ranked players" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={ratings} margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
              <XAxis
                dataKey="ratingGroup"
                stroke={AXIS_COLOR}
                tick={{ fontSize: 10 }}
                interval={Math.max(Math.floor(ratings.length / 10), 0)}
              />
              <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} tickFormatter={percentTick} />
              <Tooltip
                cursor={{ fill: AXIS_COLOR, fillOpacity: 0.1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const entry = payload[0].payload as { ratingGroup: number; share: number };
                  return (
                    <TooltipCard title={`${entry.ratingGroup} to ${entry.ratingGroup + GAP_GROUP_SIZE}`}>
                      <p>{percentLabel(entry.share)} of the ranked players</p>
                    </TooltipCard>
                  );
                }}
              />
              <Bar dataKey="share" fill={SERIES_COLOR} stroke={ACCENT_COLOR} strokeWidth={1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ContentCard>

      <ContentCard
        title="How much of the league has met"
        description="Share of the possible pairs of players that have played each other, month by month. The ranked line counts only the players who have enough games to be ranked."
      >
        {coverage === undefined || coverage.trend.length === 0 ? (
          <NotEnoughGames what="ranked players" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={coverage.trend} margin={{ top: 10, right: 10, bottom: 20, left: -10 }}>
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
              <Legend verticalAlign="top" height={28} iconType="line" />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0].payload as CoveragePoint;
                  return (
                    <TooltipCard title={formatMonth(String(label))}>
                      <p>{percentLabel(point.all)} of all the pairs had met</p>
                      <p className="opacity-80">{percentLabel(point.ranked)} of the ranked pairs had met</p>
                    </TooltipCard>
                  );
                }}
              />
              <Line type="monotone" dataKey="all" name="All players" stroke={SERIES_COLOR} strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="ranked" name="Ranked players" stroke={ACCENT_COLOR} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ContentCard>

      <ContentCard title="Ranked and unranked" description="Share of all games by how many of the two players are ranked.">
        {mix === undefined ? (
          <NotEnoughGames />
        ) : (
          <div className="flex flex-col gap-3">
            <ShareBar label="Both players ranked" share={mix.bothRanked} />
            <ShareBar label="One player ranked" share={mix.oneRanked} />
            <ShareBar label="Neither player ranked" share={mix.neitherRanked} />
          </div>
        )}
      </ContentCard>
    </div>
  );
};
