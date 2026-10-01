import React from "react";
import { Link } from "react-router-dom";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useNow } from "../../hooks/use-now";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { DRAW_TIMING, buildDrawTimeline, timelineDuration } from "../tournament/draw/draw-timeline";
import { formatCountdown, tournamentDrawUrl } from "../tournament/draw/tournament-draw-page";

/** The banner shows the countdown this long before the draw */
export const LIVE_DRAW_COUNTDOWN_WINDOW = 5 * 24 * 60 * 60 * 1000;
/** The banner stays this long after the show ends, so a viewer who missed it can watch the replay */
export const LIVE_DRAW_REPLAY_WINDOW = 60 * 60 * 1000;

export type LiveDrawPhase = "countdown" | "live" | "replay";

export function liveDrawPhase(tournament: Tournament, now: number): LiveDrawPhase | undefined {
  const config = tournament.tournamentConfig;
  if (!config.groupPlay || !config.randomGroupSeeding) return undefined;
  if (now < tournament.startDate) {
    return tournament.startDate - now <= LIVE_DRAW_COUNTDOWN_WINDOW ? "countdown" : undefined;
  }

  const anchor = tournament.startDate + DRAW_TIMING.START_DELAY;
  const groupPlay = tournament.groupPlay;
  if (groupPlay === undefined || !groupPlay.hasRandomGroupSeeding) {
    return now < anchor + LIVE_DRAW_REPLAY_WINDOW ? "live" : undefined;
  }
  const showEndsAt = anchor + timelineDuration(buildDrawTimeline(groupPlay.groups.map((group) => group.players)));
  if (now < showEndsAt) return "live";
  if (now < showEndsAt + LIVE_DRAW_REPLAY_WINDOW) return "replay";
  return undefined;
}

export const LiveDrawBanners: React.FC = () => {
  const context = useEventDbContext();
  const now = useNow();
  const banners = context.tournaments
    .getTournaments()
    .map((tournament) => ({ tournament, phase: liveDrawPhase(tournament, now) }))
    .filter((banner): banner is { tournament: Tournament; phase: LiveDrawPhase } => banner.phase !== undefined);

  return (
    <>
      {banners.map(({ tournament, phase }) => (
        <LiveDrawBanner key={tournament.id} tournament={tournament} phase={phase} now={now} />
      ))}
    </>
  );
};

const LiveDrawBanner: React.FC<{ tournament: Tournament; phase: LiveDrawPhase; now: number }> = ({
  tournament,
  phase,
  now,
}) => (
  <Link
    to={tournamentDrawUrl(tournament.id)}
    className="w-full rounded-lg p-3 text-white shadow-lg transition-all bg-gradient-to-r from-orange-600 via-amber-500 to-orange-600 hover:from-orange-500 hover:via-amber-400 hover:to-orange-500"
  >
    <div className="flex items-center justify-between gap-2 mb-1">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎲</span>
        <span className="text-xs font-bold uppercase tracking-wider">Live group draw</span>
      </div>
      <span className="text-xs opacity-80">{phase === "replay" ? "Tap to watch the replay" : "Tap to watch"}</span>
    </div>
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold text-lg truncate">{tournament.name}</span>
      {phase === "countdown" && (
        <span className="shrink-0 rounded-md bg-black/20 px-2 py-0.5 text-sm font-black tabular-nums">
          {formatCountdown(tournament.startDate - now)}
        </span>
      )}
      {phase === "live" && (
        <span className="shrink-0 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          Live now
        </span>
      )}
      {phase === "replay" && <span className="shrink-0 text-xs font-bold uppercase tracking-wider">Replay</span>}
    </div>
  </Link>
);
