import { useEventDbContext } from "../wrappers/event-db-context";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import { relativeTimeString } from "../common/date-utils";
import { fmtNum } from "../common/number-utils";

type Props = {
  player1?: string;
  player2?: string;
};

export const PvPStats: React.FC<Props> = ({ player1, player2 }) => {
  const context = useEventDbContext();

  if (!player1 || !player2) {
    return (
      <div className="text-primary-text bg-primary-background rounded-lg p-8 text-center">
        <p className="text-lg text-secondary-text/70">Please select players to compare</p>
      </div>
    );
  }

  context.futureElo.calculatePlayerFractionsForToday();

  const directPrediction = context.futureElo.playersMap.get(player1)?.oponentsMap.get(player2)?.directFraction;
  const oneLayerPrediction = context.futureElo.playersMap.get(player1)?.oponentsMap.get(player2)?.oneLayerFraction;
  const twoLayerPrediction = context.futureElo.playersMap.get(player1)?.oponentsMap.get(player2)?.twoLayerFraction;

  const combinedPrediction = context.futureElo.combinePrioritizedFractions([
    directPrediction,
    oneLayerPrediction,
    twoLayerPrediction,
  ]);

  const { player1: p1, player2: p2, games } = context.pvp.compare(player1, player2);

  return (
    <div className="space-y-6 text-primary-text">
      {/* Win Rate Pillars */}
      <div className="flex gap-4">
        <WinsPillar name={p1.name} wins={p1.wins} oponentWins={p2.wins} />
        <WinsPillar name={p2.name} wins={p2.wins} oponentWins={p1.wins} />
      </div>

      {/* Prediction Section */}
      {combinedPrediction !== undefined && (
        <div className="bg-secondary-background/20 rounded-lg p-5 border border-secondary-background/30">
          <h3 className="text-lg font-semibold mb-4 text-center">Win Probability Prediction</h3>
          <div className="flex items-center gap-4">
            {/* Player 1 Probability */}
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold text-secondary-text">{fmtNum(combinedPrediction.fraction * 100)}%</div>
              <div className="text-sm text-secondary-text/70 mt-1">{p1.name}</div>
            </div>

            {/* Visual Bar */}
            <div className="flex-[3] h-8 bg-secondary-background/30 rounded-full overflow-hidden relative">
              <div
                className="h-full bg-secondary-background transition-all duration-500"
                style={{ width: `${combinedPrediction.fraction * 100}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-secondary-text">
                VS
              </div>
            </div>

            {/* Player 2 Probability */}
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold text-secondary-text">
                {fmtNum((1 - combinedPrediction.fraction) * 100)}%
              </div>
              <div className="text-sm text-secondary-text/70 mt-1">{p2.name}</div>
            </div>
          </div>
          <p className="text-center text-secondary-text/50">
            At {fmtNum(combinedPrediction.confidence * 100)}% confidence
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Player 1 Stats */}
        <StatCard player={p1} opponent={p2} totalGames={games.length} />

        {/* Player 2 Stats */}
        <StatCard player={p2} opponent={p1} totalGames={games.length} />
      </div>

      {/* Games History */}
      <div className="bg-primary-background rounded-lg p-5 border border-secondary-background/30">
        <h3 className="text-xl font-semibold mb-4">Match History</h3>
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Table Header */}
            <div className="flex gap-4 text-sm font-semibold text-secondary-text/80 mb-3 pb-2 border-b border-secondary-background/30">
              <div className="w-44 pl-2">Winner</div>
              <div className="w-20 text-center">Points</div>
              <div className="w-32 text-center">Score</div>
              <div className="flex-1 text-right pr-2">Time</div>
            </div>

            {/* Games List */}
            <div className="space-y-1">
              {games.length === 0 ? (
                <div className="text-center py-8 text-secondary-text/60">No games played yet</div>
              ) : (
                games.map((_, index, list) => {
                  const game = list[list.length - 1 - index];
                  const isPlayer1Win = game.result === "win";
                  const winner = isPlayer1Win ? p1 : p2;

                  return (
                    <Link
                      key={`${p1.playerId}-${p2.playerId}-${index}`}
                      to={`/player/${winner.playerId}`}
                      className="flex gap-4 py-2.5 px-2 rounded-lg bg-primary-background hover:bg-secondary-background/30 transition-colors group"
                    >
                      {/* Winner Name with Trophy */}
                      <div className="w-44 font-medium flex items-center gap-2">
                        {/* Left side trophy (for player 1 wins) */}
                        <span className="text-lg w-6 flex-shrink-0 text-center">{isPlayer1Win && "🏆"}</span>
                        {/* Name (centered, truncates if too long) */}
                        <span className="truncate group-hover:text-secondary-text transition-colors flex-1 text-center">
                          {winner.name}
                        </span>
                        {/* Right side trophy (for player 2 wins) */}
                        <span className="text-lg w-6 flex-shrink-0 text-center">{!isPlayer1Win && "🏆"}</span>
                      </div>

                      {/* Points Difference */}
                      <div className="w-20 text-center flex items-center justify-center">
                        <span className="text-sm font-semibold px-2 py-1 rounded text-secondary-text bg-secondary-background/20">
                          {fmtNum(Math.abs(game.pointsDiff), { signedPositive: true })}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="w-32 flex flex-col items-center justify-center">
                        {game.score && (
                          <>
                            <div className="text-sm font-semibold">
                              {isPlayer1Win
                                ? `${game.score.setsWon.gameWinner} - ${game.score.setsWon.gameLoser}`
                                : `${game.score.setsWon.gameLoser} - ${game.score.setsWon.gameWinner}`}
                            </div>
                            {game.score.setPoints && (
                              <div className="text-xs text-secondary-text/60 italic">
                                (
                                {isPlayer1Win
                                  ? game.score.setPoints.map((set) => `${set.gameWinner}-${set.gameLoser}`).join(", ")
                                  : game.score.setPoints.map((set) => `${set.gameLoser}-${set.gameWinner}`).join(", ")}
                                )
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Time */}
                      <div className="flex-1 text-right text-sm text-secondary-text/70 flex items-center justify-end pr-2">
                        {relativeTimeString(new Date(game.time))}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  player: any;
  opponent: any;
  totalGames: number;
}> = ({ player, opponent, totalGames }) => {
  const eloDiff = player.points.currentElo - opponent.points.currentElo;
  const pointsNet = player.points.gained - player.points.lost;

  return (
    <div className="bg-secondary-background/20 rounded-lg p-5 border border-secondary-background/30">
      <h3 className="text-xl font-bold mb-4 text-center">{player.name}</h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🔥</span>
            <h4 className="font-semibold text-secondary-text">Streaks</h4>
          </div>
          <div className="pl-7 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Longest:</span>
              <span className="font-semibold">{player.streak.longest}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Current:</span>
              <span className="font-semibold">{player.streak.current}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">⭐</span>
            <h4 className="font-semibold text-secondary-text">Score comparison</h4>
          </div>
          <div className="pl-7 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Current:</span>
              <span className="font-semibold">{fmtNum(player.points.currentElo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Difference:</span>
              <span
                className={classNames("font-semibold", eloDiff > 0 ? "text-secondary-text" : "text-secondary-text/60")}
              >
                {eloDiff > 0 ? "+" : ""}
                {fmtNum(eloDiff)}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📊</span>
            <h4 className="font-semibold text-secondary-text">Score exchange</h4>
          </div>
          <div className="pl-7 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Gained:</span>
              <span className="font-semibold text-secondary-text">{fmtNum(player.points.gained)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary-text/70">Lost:</span>
              <span className="font-semibold text-secondary-text/60">{fmtNum(player.points.lost)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-secondary-background/30">
              <span className="text-secondary-text/70">Net:</span>
              <span
                className={classNames("font-bold", pointsNet > 0 ? "text-secondary-text" : "text-secondary-text/60")}
              >
                {pointsNet > 0 ? "+" : ""}
                {fmtNum(pointsNet)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const WinsPillar: React.FC<{ name: string; wins: number; oponentWins: number }> = ({
  name,
  wins,
  oponentWins,
}) => {
  const BASE_HEIGHT = 45;
  const MAX_HEIGHT = 250;
  const TEXT_INSIDE_THRESHOLD = 100;

  const heightPerWin = MAX_HEIGHT / (Math.max(wins, oponentWins) || 1);
  const pillarHeight = Math.max(wins * heightPerWin, BASE_HEIGHT);
  const showTextInside = pillarHeight >= TEXT_INSIDE_THRESHOLD;

  const winsText = () => (
    <div
      className={classNames(
        "flex flex-col items-center transition-colors",
        showTextInside ? "text-secondary-text" : "text-primary-text",
      )}
    >
      <div className="text-5xl font-semibold sm:text-6xl transition-all duration-500">{wins}</div>
    </div>
  );

  return (
    <div className="w-full flex flex-col">
      <div className="grow" />
      {!showTextInside && winsText()}
      <div
        className="w-full mt-1 py-1 flex flex-col justify-between items-center bg-secondary-background rounded-t-[2rem] md:rounded-t-[3rem] transition-all duration-500 shadow-lg"
        style={{ height: `${pillarHeight}px` }}
      >
        {showTextInside && winsText()}
        <div className="grow" />
        <p className="text-secondary-text text-xl sm:text-2xl md:text-3xl uppercase font-bold tracking-tight transition-all duration-500 px-2 text-center">
          {name}
        </p>
      </div>
    </div>
  );
};
