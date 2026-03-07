import React from "react";
import { Link, useParams } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { HallOfFameScoreBreakdown } from "../../client/client-db/hall-of-fame";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";

type FactorKey = keyof Omit<HallOfFameScoreBreakdown, "total">;

function getFactorScore(breakdown: HallOfFameScoreBreakdown, key: FactorKey): number {
  return breakdown[key].score;
}

function renderDetails(breakdown: HallOfFameScoreBreakdown, key: FactorKey): React.ReactNode {
  const data = breakdown[key];

  switch (key) {
    case "seasonPerformance": {
      const d = data as HallOfFameScoreBreakdown["seasonPerformance"];
      if (d.seasons.length === 0) return <p className="text-primary-text text-xs">No seasons participated</p>;
      const seasonTiers = [
        { label: "🥇 Win", pts: 100 },
        { label: "🥈 Top 3", pts: 75 },
        { label: "Top 5", pts: 50 },
        { label: "Top 10", pts: 30 },
        { label: "Participated", pts: 15 },
      ];
      const seasonCounts = new Map<number, number>();
      d.seasons.forEach((s) => seasonCounts.set(s.points, (seasonCounts.get(s.points) || 0) + 1));
      return (
        <div className="flex flex-wrap gap-1.5">
          {seasonTiers.map((tier) => {
            const count = seasonCounts.get(tier.pts) || 0;
            return (
              <span key={tier.label} className={classNames("px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5", count === 0 ? "bg-secondary-background/50 text-secondary-text/75" : "bg-secondary-background text-secondary-text")}>
                {tier.label}: {tier.pts} pts
                {count > 0 && (
                  <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                    {count}x
                  </span>
                )}
              </span>
            );
          })}
        </div>
      );
    }
    case "achievementsEarned": {
      const d = data as HallOfFameScoreBreakdown["achievementsEarned"];
      return (
        <div className="text-primary-text text-xs space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Achievements: 20 pts
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {d.count}x
              </span>
            </span>
          </div>
        </div>
      );
    }
    case "socialDiversity": {
      const d = data as HallOfFameScoreBreakdown["socialDiversity"];
      return (
        <div className="text-primary-text text-xs space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Unique opponents: 20 pts
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {d.uniqueOpponents}x
              </span>
            </span>
          </div>
        </div>
      );
    }
    case "tournamentProgression": {
      const d = data as HallOfFameScoreBreakdown["tournamentProgression"];
      if (d.tournaments.length === 0) return <p className="text-primary-text text-xs">No tournaments participated</p>;
      const tournamentTiers = [
        { label: "🏆 Win", placement: "Winner", pts: 300 },
        { label: "Final", placement: "Final", pts: 200 },
        { label: "Semis", placement: "Semi Finals", pts: 100 },
        { label: "Quarters", placement: "Quarter Finals", pts: 75 },
        { label: "Bracket", placement: "Bracket", pts: 50 },
        { label: "Participated", placement: "Participated", pts: 25 },
      ];
      const tournamentCounts = new Map<string, number>();
      d.tournaments.forEach((t) => tournamentCounts.set(t.placement, (tournamentCounts.get(t.placement) || 0) + 1));
      return (
        <div className="flex flex-wrap gap-1.5">
          {tournamentTiers.map((tier) => {
            const count = tournamentCounts.get(tier.placement) || 0;
            return (
              <span key={tier.label} className={classNames("px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5", count === 0 ? "bg-secondary-background/50 text-secondary-text/75" : "bg-secondary-background text-secondary-text")}>
                {tier.label}: {tier.pts} pts
                {count > 0 && (
                  <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                    {count}x
                  </span>
                )}
              </span>
            );
          })}
        </div>
      );
    }
    case "longevity": {
      const d = data as HallOfFameScoreBreakdown["longevity"];
      return (
        <div className="text-primary-text text-xs space-y-1.5">
          <p className="italic">Periods of inactivity longer than 30 days are not counted</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Active days: 1 pt
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {fmtNum(d.activeDays)}x
              </span>
            </span>
          </div>
        </div>
      );
    }
    case "experience": {
      const d = data as HallOfFameScoreBreakdown["experience"];
      return (
        <div className="text-primary-text text-xs space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Games played: 3 pts
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {fmtNum(d.games)}x
              </span>
            </span>
          </div>
        </div>
      );
    }
    case "dataVolume": {
      const d = data as HallOfFameScoreBreakdown["dataVolume"];
      return (
        <div className="text-primary-text text-xs space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Games with sets: 1 pt
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {fmtNum(d.gamesWithSets)}x
              </span>
            </span>
            <span className="bg-secondary-background text-secondary-text px-2 py-0.5 rounded text-xs inline-flex items-center gap-1.5">
              Games with points: 1 pt
              <span className="bg-tertiary-background text-tertiary-text h-5 min-w-5 px-1 rounded-full inline-flex items-center justify-center text-xs font-bold">
                {fmtNum(d.gamesWithPoints)}x
              </span>
            </span>
          </div>
        </div>
      );
    }
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

const FACTORS: { key: FactorKey; emoji: string; name: string }[] = [
  { key: "experience", emoji: "🏓", name: "Experience" },
  { key: "dataVolume", emoji: "📊", name: "Data Volume" },
  { key: "longevity", emoji: "📅", name: "Activity" },
  { key: "seasonPerformance", emoji: "🍁", name: "Season Performance" },
  { key: "tournamentProgression", emoji: "🏆", name: "Tournament Performance" },
  { key: "socialDiversity", emoji: "👥", name: "Social Diversity" },
  { key: "achievementsEarned", emoji: "🎖️", name: "Achievements Earned" },
];

export const HallOfFamePlayerPage: React.FC = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const context = useEventDbContext();

  if (!playerId) {
    return <div className="text-primary-text text-center p-8">Player not found</div>;
  }

  const player = context.eventStore.playersProjector.getPlayer(playerId);
  const isActive = player?.active ?? false;
  const entry = isActive
    ? context.hallOfFame.getScoreForAnyPlayer(playerId)
    : context.hallOfFame.getPlayerScore(playerId);

  if (!entry) {
    return (
      <div className="w-full px-4 flex flex-col items-center">
        <div className="bg-primary-background rounded-lg p-8 w-full max-w-lg text-center">
          <p className="text-secondary-background text-sm">Player not found.</p>
          <Link to="/hall-of-fame" className="text-tertiary-background hover:underline mt-4 inline-block">
            Back to Hall of Fame
          </Link>
        </div>
      </div>
    );
  }

  const total = entry.score.total || 1;

  let cumulative = 0;
  const segments = FACTORS.map((factor) => {
    const value = getFactorScore(entry.score, factor.key);
    const start = cumulative;
    cumulative += value;
    return { ...factor, value, startPct: (start / total) * 100, widthPct: (value / total) * 100 };
  });

  return (
    <div className="w-full px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header */}
        <div className="bg-primary-background rounded-lg p-4 flex items-center gap-4">
          <Link to="/hall-of-fame" className="text-primary-text hover:underline text-sm">
            &larr; Back
          </Link>
          <ProfilePicture playerId={entry.playerId} size={48} border={3} />
          <h1 className="text-2xl text-primary-text font-semibold">{entry.playerName}</h1>
        </div>

        {/* Score breakdown */}
        <div className="bg-primary-background rounded-lg p-4">
          {isActive && (
            <div className="bg-secondary-background text-secondary-text rounded-lg px-3 py-2 mb-4 text-sm">
              This is a hypothetical score — {entry.playerName} is still an active player.
            </div>
          )}
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-xl text-primary-text font-semibold">Hall of Fame Score Breakdown</h2>
            <span className="text-primary-text font-bold text-2xl">{fmtNum(entry.score.total)} pts</span>
          </div>
          <p className="text-primary-text text-sm mb-4">
            A combined score of everything you accomplished during your career.
          </p>

          <div className="space-y-6">
            {segments.map((segment) => (
              <div key={segment.key} className="ring-1 ring-secondary-background rounded-xl p-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-primary-text text-sm">
                    {segment.emoji} {segment.name}
                  </span>
                  <span className="text-primary-text font-medium text-sm">
                    {fmtNum(segment.value)} pts
                  </span>
                </div>
                <div className="w-full bg-secondary-background rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-tertiary-background h-6 rounded-full transition-all shadow-md"
                    style={{
                      marginLeft: `${segment.startPct}%`,
                      width: `${segment.widthPct}%`,
                    }}
                  />
                </div>
                <div className="mt-2">
                  {renderDetails(entry.score, segment.key)}
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 pt-4 border-t border-secondary-background flex justify-between items-center">
            <span className="text-primary-text font-bold text-sm uppercase tracking-wide">
              Final Hall of Fame Score
            </span>
            <span className="text-primary-text font-bold text-2xl">
              {fmtNum(entry.score.total)} pts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
