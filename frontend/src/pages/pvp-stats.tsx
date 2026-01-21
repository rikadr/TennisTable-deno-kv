import { useEventDbContext } from "../wrappers/event-db-context";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import { relativeTimeString } from "../common/date-utils";
import { fmtNum } from "../common/number-utils";
import { useState } from "react";

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

  const p1IsRanked = !!context.leaderboard.getPlayerSummary(player1)?.isRanked;
  const p2IsRanked = !!context.leaderboard.getPlayerSummary(player2)?.isRanked;

  return (
    <div className="space-y-6 text-primary-text">
      {/* Win Rate Pillars */}
      <div className="flex gap-4">
        <WinsPillar name={p1.name} wins={p1.wins} oponentWins={p2.wins} />
        <WinsPillar name={p2.name} wins={p2.wins} oponentWins={p1.wins} />
      </div>

      {/* Prediction Section */}
      {combinedPrediction !== undefined && (
        <div className="bg-secondary-background/20 rounded-lg p-4 border border-secondary-background/30">
          <h3 className="text-lg font-semibold text-center">Win Chanse Prediction</h3>
          {p1IsRanked && p2IsRanked ? (
            <>
              <div className="flex items-center gap-4">
                {/* Player 1 Probability */}
                <div className="flex-1 text-center">
                  <div className="text-3xl font-bold text-secondary-text">
                    {fmtNum(combinedPrediction.fraction * 100)}%
                  </div>
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
              <Link
                to={`/player/${player1}?tab=predictions&predictionTab=history&compareWith=${player2}`}
                className="block w-fit mx-auto mt-3 text-xs text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/50 px-3 py-1.5 rounded-full transition-colors"
              >
                See prediction history
              </Link>
            </>
          ) : (
            <p className="text-center">Both players must be ranked to generate a predicion</p>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <CombinedStatCard player1={p1} player2={p2} />

      {/* Games History */}
      <div className="bg-primary-background rounded-lg p-5 border border-secondary-background/30">
        <h3 className="text-xl font-semibold mb-4">Match History</h3>
        <div className="overflow-x-auto">
          <div className="min-w-[450px]">
            {/* Table Header */}
            <div className="flex text-sm font-semibold text-primary-text mb-3">
              <div className="w-40 pl-2">Winner</div>
              <div className="w-16 text-center">Points</div>
              <div className="w-24 text-center">Score</div>
              <div className="flex-1 text-right pr-2">Time</div>
            </div>

            {/* Games List */}
            <div>
              {games.length === 0 ? (
                <div className="text-center py-8 text-primary-text/60">No games played yet</div>
              ) : (
                games.map((_, index, list) => {
                  const game = list[list.length - 1 - index];
                  const isPlayer1Win = game.result === "win";
                  const winner = isPlayer1Win ? p1 : p2;

                  return (
                    <Link
                      key={`${p1.playerId}-${p2.playerId}-${index}`}
                      to={`/player/${winner.playerId}`}
                      className="flex gap-4 px-2 rounded-lg border-t-[0.5px] border-primary-text/50 bg-primary-background hover:bg-primary-text/10 transition-colors group"
                    >
                      {/* Winner Name with Trophy */}
                      <div className="w-36 font-medium flex items-center gap-0">
                        {/* Left side trophy (for player 1 wins) */}
                        <span className="text-lg w-6 flex-shrink-0 text-center">{isPlayer1Win && "🏆"}</span>
                        {/* Name (centered, truncates if too long) */}
                        <span className="truncate group-hover:text-primary-text transition-colors flex-1 text-center">
                          {winner.name}
                        </span>
                        {/* Right side trophy (for player 2 wins) */}
                        <span className="text-lg w-6 flex-shrink-0 text-center">{!isPlayer1Win && "🏆"}</span>
                      </div>

                      {/* Points Difference */}
                      <div className="w-10 text-center flex items-center justify-center">
                        <span className="text-md font-light italic">
                          {fmtNum(Math.abs(game.pointsDiff), { signedPositive: true })}
                        </span>
                      </div>

                      {/* Score */}
                      <div className="w-24 flex flex-col items-center justify-center">
                        {game.score && (
                          <>
                            <div className="text-sm font-semibold">
                              {isPlayer1Win
                                ? `${game.score.setsWon.gameWinner} - ${game.score.setsWon.gameLoser}`
                                : `${game.score.setsWon.gameLoser} - ${game.score.setsWon.gameWinner}`}
                            </div>
                            {game.score.setPoints && (
                              <div className="text-xs text-primary-text/60 italic whitespace-nowrap">
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
                      <div className="flex-1 text-right text-sm text-primary-text/70 flex items-center justify-end pr-2 whitespace-nowrap">
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

const CombinedStatCard: React.FC<{
  player1: any;
  player2: any;
}> = ({ player1, player2 }) => {
  const [show, setShow] = useState(false);
  const eloDiff = player1.points.currentElo - player2.points.currentElo;
  const pointsNet1 = player1.points.gained - player1.points.lost;
  const pointsNet2 = player2.points.gained - player2.points.lost;

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full bg-secondary-background/20 text-primary-text rounded-lg p-4 border border-secondary-background/30"
      >
        <div className="flex gap-6 justify-center">
          <h4>🔥 Streaks</h4>
          <h4>⭐ Score Comparison</h4>
          <h4>📊 Score Exchange</h4>
        </div>
        <p className="w-full text-center font-light text-primary-text/50 mt-3">Click to see details</p>
      </button>
    );
  }

  return (
    <div className="bg-secondary-background/20 text-primary-text rounded-lg p-4 border border-secondary-background/30">
      {/* Player Names Header */}
      <div className="grid grid-cols-3 gap-2 mb-3 pb-2 border-b border-secondary-background/30">
        <div className="text-right">
          <h3 className="text-lg font-bold">{player1.name}</h3>
        </div>
        <div></div>
        <div className="text-left">
          <h3 className="text-lg font-bold">{player2.name}</h3>
        </div>
      </div>

      <div className="space-y-3">
        {/* Streaks */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-base">🔥</span>
            <h4 className="font-semibold text-sm">Streaks</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-right space-y-0.5">
              <div className="font-semibold">{player1.streak.longest}</div>
              <div className="font-semibold">{player1.streak.current}</div>
            </div>
            <div className="text-center space-y-0.5 text-xs">
              <div>Longest</div>
              <div>Current</div>
            </div>
            <div className="text-left space-y-0.5">
              <div className="font-semibold">{player2.streak.longest}</div>
              <div className="font-semibold">{player2.streak.current}</div>
            </div>
          </div>
        </div>

        {/* Score Comparison */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-base">⭐</span>
            <h4 className="font-semibold text-sm">Score Comparison</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-right space-y-0.5">
              <div className="font-semibold">{fmtNum(player1.points.currentElo)}</div>
              <div className={classNames("font-semibold")}>
                {eloDiff > 0 ? "+" : ""}
                {fmtNum(eloDiff)}
              </div>
            </div>
            <div className="text-center space-y-0.5 text-xs">
              <div>Current</div>
              <div>Difference</div>
            </div>
            <div className="text-left space-y-0.5">
              <div className="font-semibold">{fmtNum(player2.points.currentElo)}</div>
              <div className={classNames("font-semibold")}>
                {eloDiff < 0 ? "+" : ""}
                {fmtNum(-eloDiff)}
              </div>
            </div>
          </div>
        </div>

        {/* Score Exchange */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <span className="text-base">📊</span>
            <h4 className="font-semibold text-sm">Score Exchange</h4>
          </div>
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="text-right space-y-0.5">
              <div className="font-semibold ">{fmtNum(player1.points.gained)}</div>
              <div className="font-semibold /60">{fmtNum(player1.points.lost)}</div>
              <div className={classNames("font-bold pt-0.5")}>
                {pointsNet1 > 0 ? "+" : ""}
                {fmtNum(pointsNet1)}
              </div>
            </div>
            <div className="text-center space-y-0.5 text-xs">
              <div>Gained</div>
              <div>Lost</div>
              <div className="pt-0.5 border-t border-secondary-background/30">Net</div>
            </div>
            <div className="text-left space-y-0.5">
              <div className="font-semibold ">{fmtNum(player2.points.gained)}</div>
              <div className="font-semibold /60">{fmtNum(player2.points.lost)}</div>
              <div className={classNames("font-bold pt-0.5")}>
                {pointsNet2 > 0 ? "+" : ""}
                {fmtNum(pointsNet2)}
              </div>
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
