import { Tournament } from "../../../client/client-db/tournaments/tournament";
import { TournamentTimelineWidget } from "./timeline-widget";

/**
 * Admin only stats tab. One widget per stat, stacked. Currently only the timeline
 */
export const TournamentStats: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  return (
    <div className="space-y-4">
      <TournamentTimelineWidget tournament={tournament} />
    </div>
  );
};
