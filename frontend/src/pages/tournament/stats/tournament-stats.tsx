import { Tournament } from "../../../client/client-db/tournaments/tournament";
import { TournamentConnectionsWidget } from "./connections-widget";
import { TournamentTimelineWidget } from "./timeline-widget";

/**
 * The statistics tab. One widget per stat, stacked
 */
export const TournamentStats: React.FC<{ tournament: Tournament }> = ({ tournament }) => {
  return (
    <div className="space-y-4">
      <TournamentTimelineWidget tournament={tournament} />
      <TournamentConnectionsWidget tournament={tournament} />
    </div>
  );
};
