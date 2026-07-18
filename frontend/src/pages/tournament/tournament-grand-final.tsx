import { Tournament } from "../../client/client-db/tournaments/tournament";
import { WinnerBox } from "../leaderboard/tournament-pending-games";
import { TournamentGameListCard } from "./tournament-bracket";

export const TournamentGrandFinal = ({
  tournament,
  itemRefs,
}: {
  tournament: Tournament;
  itemRefs: React.MutableRefObject<{
    [key: string]: HTMLElement | null;
  }>;
}) => {
  const bracket = tournament.bracket;
  if (!bracket?.grandFinal) return null;

  const grandFinal = bracket.grandFinal;
  const bracketReset = bracket.bracketReset;
  const bracketResetActivated = bracketReset?.player1 !== undefined && bracketReset?.player2 !== undefined;

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-primary-text/70">
        The winners bracket champion meets the losers bracket champion in the grand final. If the losers bracket
        champion wins the grand final, both players have one loss each — a deciding bracket reset match is played.
      </p>

      <div className="space-y-1">
        <h3 className="text-center text-sm text-primary-text">Grand Final</h3>
        <TournamentGameListCard
          tournament={tournament}
          game={grandFinal}
          itemRefs={itemRefs}
          fallbackKey="GRAND-FINAL"
        />
        <div className="flex justify-between text-xs text-primary-text/60 px-2">
          <span>Winners bracket champion</span>
          <span>Losers bracket champion</span>
        </div>
      </div>

      {bracketResetActivated && bracketReset && (
        <div className="space-y-1">
          <h3 className="text-center text-sm text-primary-text">Bracket Reset — deciding match</h3>
          <p className="text-center text-xs text-primary-text/60">
            The losers bracket champion won the grand final. Both players now have one loss, so this match decides
            the tournament.
          </p>
          <TournamentGameListCard
            tournament={tournament}
            game={bracketReset}
            itemRefs={itemRefs}
            fallbackKey="BRACKET-RESET"
          />
        </div>
      )}

      {tournament.winner && (
        <div>
          <h3 className="text-center text-sm text-primary-text mb-1">Tournament Champion</h3>
          <WinnerBox winner={tournament.winner} />
        </div>
      )}
    </div>
  );
};
