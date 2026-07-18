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

  const losersChampionName = grandFinal.player2
    ? context.playerName(grandFinal.player2)
    : "the losers bracket champion";

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

      {bracketResetActivated && bracketReset ? (
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
      ) : grandFinalDecidedWithoutReset ? (
        <div className="space-y-1">
          <h3 className="text-center text-sm text-primary-text">Bracket Reset — deciding match</h3>
          <p className="text-center text-xs text-primary-text/60">
            Not needed — the winners bracket champion won the grand final and stayed undefeated.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          <p className="text-center text-sm text-primary-text">If {losersChampionName} wins the grand final</p>
          <p className="text-center text-lg text-primary-text leading-none">↓</p>
          <h3 className="text-center text-sm text-primary-text">Bracket Reset — deciding match</h3>
          <GhostGameCard player1={grandFinal.player1} player2={grandFinal.player2} />
          <p className="text-center text-xs text-primary-text/60">
            Winning the grand final only evens the score at one loss each, so this second match would decide the
            tournament. The winners bracket champion wins the tournament by winning the grand final alone.
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
      className="relative w-full px-4 py-2 rounded-lg flex items-center gap-x-4 h-12 text-secondary-text bg-secondary-background/60 opacity-50 select-none pointer-events-none"
    >
      <h2 className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">VS</h2>
      <div className="flex gap-3 items-center justify-center">
        {player1 ? (
          <ProfilePicture playerId={player1} size={35} shape="circle" clickToEdit={false} border={3} />
        ) : (
          <QuestionMark size={38} />
        )}
        <h3>{player1 && context.playerName(player1)}</h3>
      </div>
      <div className="grow" />
      <div className="flex gap-3 items-center justify-center">
        <h3>{player2 && context.playerName(player2)}</h3>
        {player2 ? (
          <ProfilePicture playerId={player2} size={35} shape="circle" clickToEdit={false} border={3} />
        ) : (
          <QuestionMark size={38} />
        )}
      </div>
    </div>
  );
};
