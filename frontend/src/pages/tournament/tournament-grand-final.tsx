import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useEventDbContext } from "../../wrappers/event-db-context";
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
  const context = useEventDbContext();
  const bracket = tournament.bracket;
  if (!bracket?.grandFinal) return null;

  const grandFinal = bracket.grandFinal;
  const bracketReset = bracket.bracketReset;
  const bracketResetActivated = bracketReset?.player1 !== undefined && bracketReset?.player2 !== undefined;
  const grandFinalDecidedWithoutReset = grandFinal.winner !== undefined && grandFinal.winner === grandFinal.player1;

  // Only use real names once both finalists are decided; a mix of a name and a placeholder reads oddly
  const bothFinalistsKnown = grandFinal.player1 !== undefined && grandFinal.player2 !== undefined;
  const winnersChampionName = bothFinalistsKnown
    ? context.playerName(grandFinal.player1!)
    : "the first chance champion";
  const losersChampionName = bothFinalistsKnown
    ? context.playerName(grandFinal.player2!)
    : "the second chance champion";

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-primary-text/70">
        The first chance champion meets the second chance champion in the final. If the second chance champion wins the
        final, both players have one loss each — the final decider is played.
      </p>

      <div className="space-y-1">
        <h3 className="text-center text-sm text-primary-text">Final</h3>
        <TournamentGameListCard
          tournament={tournament}
          game={grandFinal}
          itemRefs={itemRefs}
          fallbackKey="GRAND-FINAL"
          size="lg"
          // The bracket reset has the same player pair; once it is activated it owns the
          // players-based scroll/highlight key (it is the pending game of the two)
          useFallbackKey={bracketResetActivated}
        />
        <div className="flex justify-between text-xs text-primary-text/60 px-2">
          <span>First chance champion</span>
          <span>Second chance champion</span>
        </div>
      </div>

      {bracketResetActivated && bracketReset ? (
        <div className="space-y-1">
          <h3 className="text-center text-sm text-primary-text">The Final Decider</h3>
          <p className="text-center text-xs text-primary-text/60">
            {losersChampionName} won the final, so {winnersChampionName} and {losersChampionName} now have one loss
            each. The winner of this match wins the tournament.
          </p>
          <TournamentGameListCard
            tournament={tournament}
            game={bracketReset}
            itemRefs={itemRefs}
            fallbackKey="BRACKET-RESET"
            size="lg"
          />
        </div>
      ) : grandFinalDecidedWithoutReset ? (
        <div className="space-y-1">
          <h3 className="text-center text-sm text-primary-text">The Final Decider</h3>
          <p className="text-center text-xs text-primary-text/60">
            Not needed — {winnersChampionName} won the final and stayed undefeated.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-center text-sm text-primary-text">If {losersChampionName} wins the final</p>
          <p className="text-center text-lg text-primary-text leading-none">↓</p>
          <h3 className="text-center text-sm text-primary-text">The Final Decider</h3>
          <TournamentGameListCard
            tournament={tournament}
            game={{ player1: grandFinal.player1, player2: grandFinal.player2 }}
            itemRefs={itemRefs}
            fallbackKey="BRACKET-RESET-PREVIEW"
            size="lg"
            ghost
          />
          <p className="text-center text-xs text-primary-text/60">
            If {winnersChampionName} wins the final, the tournament is over. If {losersChampionName} wins, both players
            have one loss each — and this match decides everything.
          </p>
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
