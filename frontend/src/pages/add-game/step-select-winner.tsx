import { Elo } from "../../client/client-db/elo";
import { classNames } from "../../common/class-names";
import { fmtNum } from "../../common/number-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { PendingTournamentGame } from "./pending-tournament-game";

export const StepSelectWinner: React.FC<{
  player1: string;
  player2: string;
  winner: string | null;
  onWinnerSelect: (playerId: string) => void;
}> = ({ player1, player2, winner, onWinnerSelect }) => {
  const context = useEventDbContext();
  const player1Elo = context.leaderboard.getPlayerSummary(player1).elo;
  const player2Elo = context.leaderboard.getPlayerSummary(player2).elo;

  const EloIfPlayer1Wins = Elo.calculateELO(player1Elo, player2Elo);
  const EloIfPlayer2Wins = Elo.calculateELO(player2Elo, player1Elo);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PendingTournamentGame player1={player1} player2={player2} />
      <h2 className="text-xl font-bold text-primary-text text-center mb-6">Who won?</h2>
      <div className="space-y-4">
        <PlayerBox
          playerId={player1}
          winner={winner}
          onWinnerSelect={onWinnerSelect}
          eloDiffAfterGame={
            (winner === player2 ? EloIfPlayer2Wins.losersNewElo : EloIfPlayer1Wins.winnersNewElo) - player1Elo
          }
        />
        <div className="text-center py-4">
          <span className="text-4xl font-bold text-primary-text">VS</span>
        </div>
        <PlayerBox
          playerId={player2}
          winner={winner}
          onWinnerSelect={onWinnerSelect}
          eloDiffAfterGame={
            (winner === player1 ? EloIfPlayer1Wins.losersNewElo : EloIfPlayer2Wins.winnersNewElo) - player2Elo
          }
        />
      </div>
    </div>
  );
};

const PlayerBox: React.FC<{
  playerId: string;
  winner: string | null;
  onWinnerSelect: (playerId: string) => void;
  eloDiffAfterGame?: number;
}> = ({ playerId, winner, onWinnerSelect, eloDiffAfterGame }) => {
  const context = useEventDbContext();

  const isWinner = playerId === winner;
  return (
    <button
      onClick={() => onWinnerSelect(playerId)}
      className={classNames(
        "w-full p-6 rounded-xl transition-all duration-200",
        isWinner
          ? "bg-tertiary-background text-tertiary-text shadow-lg"
          : "bg-primary-background text-primary-text ring-2 ring-primary-text hover:bg-secondary-background hover:text-secondary-text",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <ProfilePicture playerId={playerId} size={64} border={4} />
          <h3 className="text-xl font-semibold">{context.playerName(playerId)}</h3>
          {eloDiffAfterGame && (
            <span className="text-2xl italic font-thin">
              {eloDiffAfterGame > 0 && "+"}
              {fmtNum(eloDiffAfterGame)}
            </span>
          )}
        </div>
        {isWinner && (
          <div className="flex items-center space-x-2">
            <span className="text-3xl">🏆</span>
          </div>
        )}
      </div>
    </button>
  );
};
