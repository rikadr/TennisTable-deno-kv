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
  const player1Summary = context.leaderboard.getPlayerSummary(player1);
  const player2Summary = context.leaderboard.getPlayerSummary(player2);
  const player1Elo = player1Summary.elo;
  const player2Elo = player2Summary.elo;

  // The pending game will be each player's (games + 1)th game, so the
  // preview uses the same provisional K-factors as the real rating will.
  const player1Games = player1Summary.games.length + 1;
  const player2Games = player2Summary.games.length + 1;
  const gameLimit = context.client.gameLimitForRanked;
  const EloIfPlayer1Wins = Elo.calculateELO(player1Elo, player2Elo, player1Games, player2Games, gameLimit);
  const EloIfPlayer2Wins = Elo.calculateELO(player2Elo, player1Elo, player2Games, player1Games, gameLimit);

  const player1HasBoostedPoints = Elo.kFactor(player1Games, gameLimit) > Elo.K;
  const player2HasBoostedPoints = Elo.kFactor(player2Games, gameLimit) > Elo.K;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PendingTournamentGame key={`${player1}-${player2}`} player1={player1} player2={player2} />
      <h2 className="text-xl font-bold text-primary-text text-center mb-6">Who won?</h2>
      <div className="space-y-4">
        <PlayerBox
          playerId={player1}
          winner={winner}
          onWinnerSelect={onWinnerSelect}
          boostedPoints={player1HasBoostedPoints}
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
          boostedPoints={player2HasBoostedPoints}
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
  boostedPoints?: boolean;
}> = ({ playerId, winner, onWinnerSelect, eloDiffAfterGame, boostedPoints }) => {
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
          <div className="flex flex-col items-start text-left">
            <h3 className="text-xl font-semibold">{context.playerName(playerId)}</h3>
            {boostedPoints && (
              <span className="text-xs italic opacity-80">⚡ Bigger point swings until ranked</span>
            )}
          </div>
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
