import React, { useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { AchievementType } from "../../client/client-db/achievements";
import { ACHIEVEMENT_LABELS, getAchievementLabel } from "../player/player-achievements";
import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENT_TYPE_TO_GROUP_ID,
  orderAchievementTypes,
  OTHER_ACHIEVEMENT_GROUP,
} from "../player/achievement-groups";
import { ProfilePicture } from "../player/profile-picture";
import { StatTile, StatTileRow } from "../statistics/stat-tile";
import { AXIS_COLOR, SERIES_COLOR } from "../statistics/percent-chart";
import { dateString, relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { achievementDetails, MonthBucket, ValueSummary } from "./achievement-stats";
import { playersProgressForType } from "./progress-rows";
import { AchievementFacts } from "./achievement-facts";
import { playerAchievementProgressLink } from "../player/player-achievement-link";
import { achievementsLink } from "./use-achievements-filter";

const CLOSEST_PLAYERS = 3;
/** Above this many earnings the spread reads better as a histogram. */
const VALUE_BARS_MAX = 12;

/** fmtNum returns undefined for an undefined number, which no tile can show. */
const orDash = (value: string | undefined): string => value ?? "–";

type Props = {
  type: AchievementType;
  /** How many earnings the Recent tab lists for this type. */
  earnedCount: number;
  onShowProgress: () => void;
  onShowRecent: () => void;
};

export const AchievementDetails: React.FC<Props> = ({ type, earnedCount, onShowProgress, onShowRecent }) => {
  const context = useEventDbContext();
  const label = getAchievementLabel(type, context.client.gameLimitForRanked);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const now = Date.now();

  // The order of the player's Progress tab, so the two pages read the
  // achievements in the same order. The ends join, so Next always has one.
  const ordered = useMemo(
    () => orderAchievementTypes(Object.keys(ACHIEVEMENT_LABELS)) as AchievementType[],
    [],
  );
  const position = ordered.indexOf(type);
  const previousType = ordered[(position - 1 + ordered.length) % ordered.length];
  const nextType = ordered[(position + 1) % ordered.length];

  const detailsLink = (target: AchievementType) => achievementsLink(searchParams, { type: target, view: "details" });

  function goToRandom() {
    const others = ordered.filter((candidate) => candidate !== type);
    navigate(detailsLink(others[Math.floor(Math.random() * others.length)]));
  }

  const details = useMemo(() => {
    const allAchievements = [...context.achievements.achievementMap.values()].flat();
    const firstGameByPlayer = new Map<string, number>();
    context.games.forEach((game) => {
      [game.winner, game.loser].forEach((playerId) => {
        const known = firstGameByPlayer.get(playerId);
        if (known === undefined || game.playedAt < known) firstGameByPlayer.set(playerId, game.playedAt);
      });
    });

    return achievementDetails({
      type,
      allAchievements,
      allTypes: Object.keys(ACHIEVEMENT_LABELS) as AchievementType[],
      playerCount: context.allPlayers.length,
      firstGameByPlayer,
      now: Date.now(),
    });
  }, [context.achievements.achievementMap, context.games, context.allPlayers, type]);

  // The players closest to earning it, the ones who do not hold it yet.
  const closest = useMemo(() => {
    const rows = playersProgressForType(context, type);
    return {
      chasing: rows.filter((row) => row.earned === 0 && row.percent > 0).slice(0, CLOSEST_PLAYERS),
      noProgress: rows.filter((row) => row.earned === 0 && row.percent === 0).length,
    };
  }, [context, type]);

  const group =
    ACHIEVEMENT_GROUPS.find((candidate) => candidate.id === ACHIEVEMENT_TYPE_TO_GROUP_ID.get(type)) ??
    OTHER_ACHIEVEMENT_GROUP;

  // A player with no name event still needs a name in a table.
  const playerName = (playerId: string) => context.playerName(playerId) ?? playerId;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 text-primary-text">
      {/* Walk the achievements in the order of the player's Progress tab. */}
      <nav className="flex items-center gap-2">
        <NavButton to={detailsLink(previousType)} label={ACHIEVEMENT_LABELS[previousType].title}>
          <span aria-hidden>←</span> {ACHIEVEMENT_LABELS[previousType].icon}
        </NavButton>
        <button
          onClick={goToRandom}
          type="button"
          title="A random achievement"
          className="px-3 py-2 rounded-lg text-sm bg-secondary-background text-secondary-text border border-secondary-text hover:opacity-80 transition-opacity"
        >
          🎲 <span className="hidden xs:inline">Random</span>
        </button>
        <NavButton to={detailsLink(nextType)} label={ACHIEVEMENT_LABELS[nextType].title} alignEnd>
          {ACHIEVEMENT_LABELS[nextType].icon} <span aria-hidden>→</span>
        </NavButton>
      </nav>

      {/* Identity */}
      <div className="flex items-start gap-4">
        <div className="text-5xl shrink-0">{label.icon}</div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">{label.title}</h2>
          <p className="opacity-80">{label.description}</p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="rounded-full px-2.5 py-1 bg-secondary-background text-secondary-text">
              {group.icon} {group.title}
            </span>
            <span className="rounded-full px-2.5 py-1 bg-secondary-background text-secondary-text">
              {details.isReachievable ? "Can be earned again" : "One time only"}
            </span>
          </div>
        </div>
      </div>

      {/* Scarcity */}
      <StatTileRow>
        <StatTile label="Times earned" value={orDash(fmtNum(details.rarity.earnings))} />
        <StatTile
          label="Players who hold it"
          value={`${fmtNum(details.rarity.holders)} of ${fmtNum(details.playerCount)}`}
          note={`${fmtNum(details.holderShare, { digits: 0 })}% of all players`}
        />
        <StatTile
          label="Rarity"
          value={`${ordinal(details.rarity.rank)} of ${fmtNum(details.rarity.total)}`}
          note="Rarest first, by players who hold it"
        />
        <StatTile
          label="Last earned"
          value={daysAgoLabel(details.daysSinceLatest)}
          note={details.latest ? playerName(details.latest.earnedBy) : "Nobody has earned this"}
        />
      </StatTileRow>

      {details.rarity.earnings === 0 ? (
        <Section title="Nobody has earned this yet">
          <p className="text-sm opacity-80">
            The progress list shows who is closest.{" "}
            <button onClick={onShowProgress} className="underline">
              Everyone's progress
            </button>
          </p>
        </Section>
      ) : (
        <>
          {/* Record history */}
          {details.recordHistory && details.recordHistory.length > 0 && details.values && (
            <Section title="The record over time">
              <div className="space-y-1">
                {[...details.recordHistory].reverse().map((step) => (
                  <div
                    key={`${step.at}-${step.value}`}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text"
                  >
                    <span className="font-semibold tabular-nums">{details.values!.metric.format(step.value)}</span>
                    <span className="text-sm">{step.holders.map(playerName).join(" & ")}</span>
                    <span className="text-xs opacity-70 whitespace-nowrap">
                      {dateString(step.at)}
                      {step.heldUntil === undefined
                        ? ` — ${standsToday(step.at, now)}`
                        : ` — held ${heldFor(step.at, step.heldUntil)}`}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* The spread of the values. A record only ever climbs, so its steps
              are the record chart above, not a spread. */}
          {details.values && !details.recordHistory && (
            <Section title={details.values.metric.label}>
              <StatTileRow columns={3}>
                <StatTile
                  label="Highest"
                  value={details.values.metric.format(details.values.highest.value)}
                  note={playerName(details.values.highest.playerId)}
                />
                <StatTile
                  label="Lowest"
                  value={details.values.metric.format(details.values.lowest.value)}
                  note={playerName(details.values.lowest.playerId)}
                />
                <StatTile label="Average" value={details.values.metric.format(details.values.average)} />
              </StatTileRow>
              {/* One bar per earning while they are few: a distinct value for
                  every earning makes every bar of a histogram 1 tall, which
                  shows no spread at all. */}
              {details.values.measured.length <= VALUE_BARS_MAX ? (
                <ValueBars values={details.values} playerName={playerName} />
              ) : (
                details.values.buckets.length > 1 && <CountChart data={details.values.buckets} name="Earnings" />
              )}
            </Section>
          )}

          {/* Holders */}
          <Section title={details.isReachievable ? "Who holds it most" : "Who holds it"}>
            <div className="space-y-1">
              {details.topHolders.map((holder, index) => (
                <div
                  key={holder.playerId}
                  className="rounded-lg px-3 py-2 bg-secondary-background text-secondary-text"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right opacity-60 font-bold">#{index + 1}</span>
                    <Link to={playerAchievementProgressLink(holder.playerId, type)} className="shrink-0">
                      <ProfilePicture playerId={holder.playerId} size={28} border={2} />
                    </Link>
                    <Link
                      to={playerAchievementProgressLink(holder.playerId, type)}
                      className="flex-1 font-medium hover:underline truncate"
                    >
                      {playerName(holder.playerId)}
                    </Link>
                    {details.isReachievable && <span className="text-sm tabular-nums">{fmtNum(holder.count)}×</span>}
                    <span className="text-xs opacity-70 whitespace-nowrap">{dateString(holder.latestAt)}</span>
                  </div>
                  {/* What the holder did to earn it, in the words the recent
                      list uses. A repeatable achievement describes the latest
                      of their earnings. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 pl-9">
                    <AchievementFacts achievement={holder.latest} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm opacity-80">
              <button onClick={onShowRecent} className="underline">
                All {fmtNum(earnedCount)} earning{earnedCount === 1 ? "" : "s"}
              </button>
            </p>
          </Section>

          {/* Opponents */}
          {details.topOpponents.length > 0 && (
            <Section title="Most often on the other side">
              <div className="flex flex-wrap gap-2">
                {details.topOpponents.map((opponent) => (
                  <span
                    key={opponent.key}
                    className="rounded-full px-3 py-1 text-sm bg-secondary-background text-secondary-text"
                  >
                    {playerName(opponent.key)} <span className="opacity-70">{fmtNum(opponent.count)}×</span>
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* First and latest */}
          <Section title="First and latest">
            <div className="grid gap-2 sm:grid-cols-2">
              {details.first && <Milestone label="First earned" playerId={details.first.earnedBy} at={details.first.earnedAt} name={playerName(details.first.earnedBy)} />}
              {details.latest && <Milestone label="Latest earned" playerId={details.latest.earnedBy} at={details.latest.earnedAt} name={playerName(details.latest.earnedBy)} />}
            </div>
          </Section>

          {/* Pace */}
          {details.perMonth.length > 1 && (
            <Section title="Earned per month">
              <CountChart data={details.perMonth.map((bucket) => ({ label: monthLabel(bucket), count: bucket.count }))} name="Earnings" />
            </Section>
          )}

          {details.timeToEarn && (
            <Section title="Time to earn it">
              <StatTileRow columns={3}>
                <StatTile label="Typical" value={dayLabel(details.timeToEarn.medianDays)} note="From a player's first game" />
                <StatTile
                  label="Fastest"
                  value={dayLabel(details.timeToEarn.fastest.days)}
                  note={playerName(details.timeToEarn.fastest.playerId)}
                />
                <StatTile
                  label="Slowest"
                  value={dayLabel(details.timeToEarn.slowest.days)}
                  note={playerName(details.timeToEarn.slowest.playerId)}
                />
              </StatTileRow>
            </Section>
          )}

          {/* Tournaments and seasons */}
          {details.perTournament.length > 0 && (
            <Section title="Per tournament">
              <CountRows
                rows={details.perTournament.map((row) => ({
                  key: row.key,
                  label: context.tournaments.getTournament(row.key)?.tournamentConfig.name ?? "Tournament",
                  count: row.count,
                }))}
              />
            </Section>
          )}

          {details.perSeason.length > 0 && (
            <Section title="Per season">
              <CountRows
                rows={details.perSeason.map((row) => ({
                  key: row.key,
                  label: seasonLabel(context.seasons.getSeasons(), Number(row.key)),
                  count: row.count,
                }))}
              />
            </Section>
          )}
        </>
      )}

      {/* Who is next */}
      <Section title="Closest to earning it">
        {closest.chasing.length === 0 ? (
          <p className="text-sm opacity-80">No player has progress towards this achievement.</p>
        ) : (
          <div className="space-y-1">
            {closest.chasing.map((row) => (
              <div
                key={row.player.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text"
              >
                <Link to={playerAchievementProgressLink(row.player.id, type)} className="shrink-0">
                  <ProfilePicture playerId={row.player.id} size={28} border={2} />
                </Link>
                <Link
                  to={playerAchievementProgressLink(row.player.id, type)}
                  className="flex-1 font-medium hover:underline truncate"
                >
                  {row.player.name}
                </Link>
                <span className="font-semibold tabular-nums">{row.percent}%</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-sm opacity-80">
          {fmtNum(closest.noProgress)} player{closest.noProgress === 1 ? "" : "s"} have no progress yet.{" "}
          <button onClick={onShowProgress} className="underline">
            Everyone's progress
          </button>
        </p>
      </Section>
    </div>
  );
};

/**
 * A step to the achievement before or after this one. The name of the target
 * is the accessible name, and it shows from the sm breakpoint up — a phone has
 * room for the icon and the arrow alone.
 */
const NavButton: React.FC<{ to: string; label: string; alignEnd?: boolean; children: React.ReactNode }> = ({
  to,
  label,
  alignEnd,
  children,
}) => (
  <Link
    to={to}
    aria-label={label}
    title={label}
    className={classNames(
      "flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-secondary-background text-secondary-text border border-secondary-text hover:opacity-80 transition-opacity",
      alignEnd ? "justify-end" : "justify-start",
    )}
  >
    {!alignEnd && children}
    <span className="truncate hidden sm:inline">{label}</span>
    {alignEnd && children}
  </Link>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col gap-2">
    <h3 className="text-lg font-semibold">{title}</h3>
    {children}
  </section>
);

const Milestone: React.FC<{ label: string; playerId: string; name: string; at: number }> = ({
  label,
  playerId,
  name,
  at,
}) => (
  <div className="rounded-lg px-3 py-2 bg-secondary-background text-secondary-text">
    <div className="text-xs opacity-80">{label}</div>
    <div className="flex items-center gap-2 mt-1">
      <ProfilePicture playerId={playerId} size={24} border={2} />
      <span className="font-medium truncate">{name}</span>
    </div>
    <div className="text-xs opacity-70 mt-1">
      {dateString(at)} — {relativeTimeString(new Date(at))}
    </div>
  </div>
);

const CountRows: React.FC<{ rows: { key: string; label: string; count: number }[] }> = ({ rows }) => (
  <div className="space-y-1">
    {rows.map((row) => (
      <div
        key={row.key}
        className="flex items-baseline justify-between gap-3 rounded-lg px-3 py-2 bg-secondary-background text-secondary-text"
      >
        <span className="truncate">{row.label}</span>
        <span className="font-semibold tabular-nums whitespace-nowrap">{fmtNum(row.count)}×</span>
      </div>
    ))}
  </div>
);

/**
 * A bar per earning, longest first. The length of a bar is the value against
 * the highest one, so the spread of the values is the shape of the block.
 */
const ValueBars: React.FC<{ values: ValueSummary; playerName: (playerId: string) => string }> = ({
  values,
  playerName,
}) => (
  <div className="flex flex-col gap-1.5">
    {values.measured.map((measured) => (
      <div key={`${measured.playerId}-${measured.at}`} className="flex flex-col gap-0.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate">{playerName(measured.playerId)}</span>
          <span className="font-semibold tabular-nums whitespace-nowrap">{values.metric.format(measured.value)}</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-secondary-background/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-text"
            style={{ width: `${values.highest.value > 0 ? (measured.value / values.highest.value) * 100 : 100}%` }}
          />
        </div>
      </div>
    ))}
  </div>
);

/** A bar per bucket. Used for the months and for the spread of the values. */
export const CountChart: React.FC<{ data: { label: string; count: number }[]; name: string }> = ({ data, name }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLOR} opacity={0.3} />
      <XAxis dataKey="label" stroke={AXIS_COLOR} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
      <YAxis stroke={AXIS_COLOR} tick={{ fontSize: 11 }} allowDecimals={false} />
      <Tooltip
        content={({ active, payload, label }) =>
          active && payload && payload.length > 0 ? (
            <div className="bg-secondary-background text-secondary-text p-2 rounded-lg border border-secondary-text text-sm">
              <p className="font-semibold">{String(label)}</p>
              <p>
                {name}: {fmtNum(Number(payload[0].value))}
              </p>
            </div>
          ) : null
        }
      />
      <Bar dataKey="count" fill={SERIES_COLOR} radius={[4, 4, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>
);

function ordinal(rank: number): string {
  const rest = rank % 100;
  if (rest >= 11 && rest <= 13) return `${rank}th`;
  return `${rank}${["th", "st", "nd", "rd"][rank % 10] ?? "th"}`;
}

/** The day of the latest earning, counted in calendar days. */
function daysAgoLabel(days: number | undefined): string {
  if (days === undefined) return "Never";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${fmtNum(days)} days ago`;
}

function dayLabel(days: number): string {
  const rounded = Math.round(days);
  return `${fmtNum(rounded)} day${rounded === 1 ? "" : "s"}`;
}

/** How long the record that still stands has stood. */
function standsToday(from: number, now: number): string {
  const days = Math.round((now - from) / (24 * 60 * 60 * 1000));
  return days < 1 ? "stands today" : `stands today after ${fmtNum(days)} day${days === 1 ? "" : "s"}`;
}

function heldFor(from: number, to: number): string {
  const days = Math.round((to - from) / (24 * 60 * 60 * 1000));
  return days < 1 ? "less than a day" : `${fmtNum(days)} day${days === 1 ? "" : "s"}`;
}

export function monthLabel(bucket: MonthBucket): string {
  return new Date(bucket.timestamp).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function seasonLabel(seasons: { start: number }[], start: number): string {
  const index = seasons.findIndex((season) => season.start === start);
  return index >= 0 ? `Season ${index + 1}` : dateString(start);
}
