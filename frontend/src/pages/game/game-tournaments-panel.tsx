import { useNavigate } from "react-router-dom";
import { TournamentGamePlacement } from "../../client/client-db/tournaments/tournament";
import { tournamentGameLink, tournamentPlacementLabels } from "../tournament/tournament-game-location";

/**
 * The tournaments a game was part of, and where it sat in each of them. Two tournaments that run
 * at the same time both count a game played between their players, so a game can hold a place in
 * more than one. A row opens the tournament page on the tab that holds the game, scrolled to its
 * card.
 */
export const GameTournaments: React.FC<{ placements: TournamentGamePlacement[] }> = ({ placements }) => {
  const navigate = useNavigate();

  if (placements.length === 0) return null;

  return (
    <div className="px-2 xs:px-4 pb-3 space-y-2">
      <h2 className="text-sm font-semibold text-center text-primary-text">
        {placements.length === 1 ? "Tournament" : "Tournaments"}
      </h2>
      <div className="bg-primary-background rounded-lg w-full max-w-md mx-auto overflow-hidden ring-1 ring-primary-text/20">
        <table className="w-full text-primary-text border-collapse">
          <tbody className="divide-y divide-primary-text/50">
            {placements.map((placement) => {
              const { stage, round } = tournamentPlacementLabels(placement);
              return (
                <tr
                  key={placement.tournament.id}
                  onClick={() => navigate(tournamentGameLink(placement.tournament.id, placement))}
                  className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-xs xs:text-sm md:text-base"
                >
                  <td className="py-1 px-1 xs:px-2 md:px-3 w-[1%]">
                    <span className="text-xl md:text-2xl">🏆</span>
                  </td>
                  <td className="py-1 px-1 xs:px-2 w-[50%] max-w-0">
                    <div className="truncate font-normal">{placement.tournament.name}</div>
                  </td>
                  <td className="py-1 px-1 xs:px-2 md:px-3 w-[50%] max-w-0 text-right">
                    <div className="truncate font-normal">{round}</div>
                    {/* A round that already says which part of the tournament it is in says it once */}
                    {stage !== round && <div className="truncate text-xs font-light opacity-70">{stage}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
