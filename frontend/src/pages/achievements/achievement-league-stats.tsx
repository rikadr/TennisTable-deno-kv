import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { AchievementType } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS } from "../player/player-achievements";
import { ProfilePicture } from "../player/profile-picture";
import { StatTile, StatTileRow } from "../statistics/stat-tile";
import { fmtNum } from "../../common/number-utils";
import { leagueAchievementStats, RarityEntry } from "./achievement-stats";
import { CountChart, monthLabel } from "./achievement-details";

type Props = {
  /** Opens the details of one achievement, which the rows link to. */
  detailsLink: (type: AchievementType) => string;
};

/** The whole league's achievements, shown when no achievement is selected. */
export const AchievementLeagueStats: React.FC<Props> = ({ detailsLink }) => {
  const context = useEventDbContext();

  const stats = useMemo(
    () =>
      leagueAchievementStats({
        allAchievements: [...context.achievements.achievementMap.values()].flat(),
        allTypes: Object.keys(ACHIEVEMENT_LABELS) as AchievementType[],
        firstGameAt: context.games.reduce((first, game) => Math.min(first, game.playedAt), Date.now()),
        now: Date.now(),
      }),
    [context.achievements.achievementMap, context.games],
  );

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 text-primary-text">
      <div>
        <h2 className="text-2xl font-bold">Achievements in the league</h2>
        <p className="opacity-80">Select an achievement in the filter to see its own stats.</p>
      </div>

      <StatTileRow columns={3}>
        <StatTile label="Achievements earned" value={`${fmtNum(stats.totalEarnings)}`} />
        <StatTile
          label="Types earned"
          value={`${fmtNum(stats.earnedTypes)} of ${fmtNum(stats.totalTypes)}`}
          note={`${fmtNum(stats.neverEarned.length)} never earned`}
        />
        <StatTile label="Players with one or more" value={`${fmtNum(stats.playersWithAchievements)}`} />
      </StatTileRow>

      <div className="grid gap-6 sm:grid-cols-2">
        <RarityList title="Rarest" entries={stats.rarest} detailsLink={detailsLink} />
        <RarityList title="Most common" entries={stats.mostCommon} detailsLink={detailsLink} />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Never earned</h3>
        {stats.neverEarned.length === 0 ? (
          <p className="text-sm opacity-80">Every achievement has an owner.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {stats.neverEarned.map((type) => (
              <Link
                key={type}
                to={detailsLink(type)}
                className="rounded-full px-3 py-1 text-sm bg-secondary-background text-secondary-text hover:underline"
              >
                {ACHIEVEMENT_LABELS[type].icon} {ACHIEVEMENT_LABELS[type].title}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">Most decorated players</h3>
        <div className="space-y-1">
          {stats.topPlayers.map((row, index) => (
            <div
              key={row.playerId}
              className="flex items-center gap-3 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text"
            >
              <span className="w-6 text-right opacity-60 font-bold">#{index + 1}</span>
              <Link to={`/player/${row.playerId}?tab=achievements`} className="shrink-0">
                <ProfilePicture playerId={row.playerId} size={28} border={2} />
              </Link>
              <Link
                to={`/player/${row.playerId}?tab=achievements`}
                className="flex-1 font-medium hover:underline truncate"
              >
                {context.playerName(row.playerId) ?? row.playerId}
              </Link>
              <span className="text-sm tabular-nums whitespace-nowrap">
                {fmtNum(row.types)} types
              </span>
              <span className="text-xs opacity-70 tabular-nums whitespace-nowrap">{fmtNum(row.earnings)} earned</span>
            </div>
          ))}
        </div>
      </section>

      {stats.perMonth.length > 1 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">Earned per month</h3>
          <CountChart
            data={stats.perMonth.map((bucket) => ({ label: monthLabel(bucket), count: bucket.count }))}
            name="Achievements"
          />
        </section>
      )}
    </div>
  );
};

const RarityList: React.FC<{
  title: string;
  entries: RarityEntry[];
  detailsLink: (type: AchievementType) => string;
}> = ({ title, entries, detailsLink }) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-lg font-semibold">{title}</h3>
    <div className="space-y-1">
      {entries.map((entry) => (
        <Link
          key={entry.type}
          to={detailsLink(entry.type)}
          className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text hover:underline"
        >
          <span className="truncate">
            {ACHIEVEMENT_LABELS[entry.type].icon} {ACHIEVEMENT_LABELS[entry.type].title}
          </span>
          <span className="text-sm tabular-nums whitespace-nowrap">
            {fmtNum(entry.holders)} player{entry.holders === 1 ? "" : "s"}
          </span>
        </Link>
      ))}
    </div>
  </section>
);
