import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { WinnerBox } from "../leaderboard/tournament-pending-games";
import { ProfilePicture } from "../player/profile-picture";
import { QuestionMark, TournamentGameListCard } from "./tournament-bracket";

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
  const grandFinalDecidedWithoutReset =
    grandFinal.winner !== undefined && grandFinal.winner === grandFinal.player1;

  // Only use real names once both finalists are decided; a mix of a name and a placeholder reads oddly
  const bothFinalistsKnown = grandFinal.player1 !== undefined && grandFinal.player2 !== undefined;
  const winnersChampionName = bothFinalistsKnown
    ? context.playerName(grandFinal.player1!)
    : "the winners bracket champion";
  const losersChampionName = bothFinalistsKnown
    ? context.playerName(grandFinal.player2!)
    : "the losers bracket champion";

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-primary-text/70">
        The winners bracket champion meets the losers bracket champion in the grand final. If the losers bracket
        champion wins the grand final, both players have one loss each — the final decider is played.
      </p>

      <div className="space-y-1">
        <h3 className="text-center text-sm text-primary-text">Grand Final</h3>
        <TournamentGameListCard
          tournament={tournament}
          game={grandFinal}
          itemRefs={itemRefs}
          fallbackKey="GRAND-FINAL"
          size="lg"
        />
        <div className="flex justify-between text-xs text-primary-text/60 px-2">
          <span>Winners bracket champion</span>
          <span>Losers bracket champion</span>
        </div>
      </div>

      {bracketResetActivated && bracketReset ? (
        <div className="space-y-1">
          <h3 className="text-center text-sm text-primary-text">The Final Decider</h3>
          <p className="text-center text-xs text-primary-text/60">
            {losersChampionName} won the grand final, so {winnersChampionName} and {losersChampionName} now have one
            loss each. The winner of this match wins the tournament.
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
            Not needed — {winnersChampionName} won the grand final and stayed undefeated.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-center text-sm text-primary-text">If {losersChampionName} wins the grand final</p>
          <p className="text-center text-lg text-primary-text leading-none">↓</p>
          <h3 className="text-center text-sm text-primary-text">The Final Decider</h3>
          <GhostGameCard player1={grandFinal.player1} player2={grandFinal.player2} />
          <p className="text-center text-xs text-primary-text/60">
            If {winnersChampionName} wins the grand final, the tournament is over. If {losersChampionName} wins,
            both players have one loss each — and this match decides everything.
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

/** Preview of a game that may happen: looks like a game card, but faded and not interactive */
const GhostGameCard = ({ player1, player2 }: { player1?: string; player2?: string }) => {
  const context = useEventDbContext();
  return (
    <div
      aria-disabled
      className="relative w-full px-5 py-4 rounded-xl flex items-center gap-x-4 h-24 text-secondary-text bg-secondary-background/60 opacity-50 select-none pointer-events-none"
    >
      <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xl font-bold italic">
        VS
      </h2>
      <div className="flex gap-3 items-center justify-center">
        {player1 ? (
          <ProfilePicture playerId={player1} size={60} shape="circle" clickToEdit={false} border={4} />
        ) : (
          <QuestionMark size={64} />
        )}
        <h3 className="text-xl md:text-2xl font-semibold">{player1 && context.playerName(player1)}</h3>
      </div>
      <div className="grow" />
      <div className="flex gap-3 items-center justify-center">
        <h3 className="text-xl md:text-2xl font-semibold">{player2 && context.playerName(player2)}</h3>
        {player2 ? (
          <ProfilePicture playerId={player2} size={60} shape="circle" clickToEdit={false} border={4} />
        ) : (
          <QuestionMark size={64} />
        )}
      </div>
    </div>
  );
};
