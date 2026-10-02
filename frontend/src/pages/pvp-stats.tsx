import { useEventDbContext } from "../wrappers/event-db-context";
import { classNames } from "../common/class-names";
import { Link } from "react-router-dom";
import { RelativeTime } from "../common/date-utils";
import { fmtNum } from "../common/number-utils";
import { useEffect, useState } from "react";
import { GameMarkers } from "./game/game-markers";
import { ProfilePicture } from "./player/profile-picture";

type Props = {
  player1: string;
  player2: string;
};

export const PvPWins: React.FC<Props> = ({ player1, player2 }) => {
  const context = useEventDbContext();
  const { player1: p1, player2: p2 } = context.pvp.compare(player1, player2);
  const total = p1.wins + p2.wins;
  // Player 2 gets the rest, so the 2 shares always add up to 100%
  const p1Share = total === 0 ? 0 : Math.round((p1.wins / total) * 100);
  const p2Share = total === 0 ? 0 : 100 - p1Share;

  return (
    <div>
      <div className="flex items-end gap-3 h-56 sm:h-64">
        <WinsPillar wins={p1.wins} oponentWins={p2.wins} />
        <WinsPillar wins={p2.wins} oponentWins={p1.wins} />
      </div>
      <div className="flex justify-between gap-2 text-xs text-primary-text/70 px-1 mt-2">
        <span>{p1Share}% of the games</span>
        <span>{total} games</span>
        <span>{p2Share}% of the games</span>
      </div>
    </div>
  );
};

const WinsPillar: React.FC<{ wins: number; oponentWins: number }> = ({ wins, oponentWins }) => {
  // The height of the pillar is in proportion to the wins. A pillar with few wins keeps a
  // small base, so it stays visible
  const height = (wins / Math.max(wins, oponentWins, 1)) * 100;
  // The number and the label need about half of the height. A lower pillar shows them above it
  const textInside = height >= 50;

  const winsText = (
    <div className={classNames("flex flex-col items-center", textInside ? "pt-3" : "pb-1 text-primary-text")}>
      <span className="text-5xl sm:text-6xl font-bold tabular-nums leading-none">{wins}</span>
      <span className="text-[11px] uppercase tracking-widest opacity-80 mt-1">wins</span>
    </div>
  );

  return (
    <div className="flex-1 h-full flex flex-col justify-end">
      {!textInside && winsText}
      <div
        className="rounded-t-[2rem] bg-secondary-background text-secondary-text shadow-lg transition-all duration-500"
        style={{ height: `max(${height}%, 2.5rem)` }}
      >
        {textInside && winsText}
      </div>
    </div>
  );
};

const PredictionCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-secondary-background/20 rounded-2xl p-3 sm:p-4 ring-1 ring-secondary-background/40">
    <h3 className="text-xs uppercase tracking-wider text-primary-text/70 text-center">Win chance in the next game</h3>
    {children}
  </div>
);

export const WinChancePrediction: React.FC<Props> = ({ player1, player2 }) => {
  const context = useEventDbContext();
  const player1Name = context.playerName(player1);
  const player2Name = context.playerName(player2);

  // Mirror the player-page predictions tab: when at least one player is unranked
  // the prediction is gated behind a warning the user must acknowledge before it
  // is shown. Reset the acknowledgement whenever the matchup changes.
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
  }, [player1, player2]);

  const p1Summary = context.leaderboard.getPlayerSummary(player1);
  const p2Summary = context.leaderboard.getPlayerSummary(player2);
  const p1IsRanked = !!p1Summary?.isRanked;
  const p2IsRanked = !!p2Summary?.isRanked;
  const p1HasGames = (p1Summary?.games.length ?? 0) > 0;
  const p2HasGames = (p2Summary?.games.length ?? 0) > 0;

  // Retirement is not a reason to withhold a prediction — a retired player's game
  // history is still there, and that is all the model needs.
  const prediction = context.predictions.getPredictedFraction(player1, player2);

  // A player without a single game has nothing to predict from, so the unranked
  // gate is not offered at all for that matchup.
  if (!p1HasGames || !p2HasGames) {
    return (
      <PredictionCard>
        <p className="text-center text-primary-text/70 mt-2">
          Cannot predict win chance —{" "}
          {!p1HasGames && !p2HasGames
            ? `${player1Name} and ${player2Name} have`
            : `${!p1HasGames ? player1Name : player2Name} has`}{" "}
          no games played
        </p>
      </PredictionCard>
    );
  }

  if (prediction === undefined) {
    return (
      <PredictionCard>
        <p className="text-center text-primary-text/70 mt-2">
          Cannot predict win chance — no games connect {player1Name} and {player2Name}
        </p>
      </PredictionCard>
    );
  }

  const bothRanked = p1IsRanked && p2IsRanked;
  const unrankedLabel =
    !p1IsRanked && !p2IsRanked
      ? `${player1Name} and ${player2Name} are not ranked`
      : `${!p1IsRanked ? player1Name : player2Name} is not ranked`;

  if (!bothRanked && !revealed) {
    return (
      <PredictionCard>
        <div className="mx-auto mt-3 max-w-md rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-5 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-lg font-semibold mb-1">{unrankedLabel}</p>
          <p className="text-sm text-primary-text/70 mb-4">
            The prediction is based on insufficient data and may be unreliable.
          </p>
          <button
            onClick={() => setRevealed(true)}
            className="rounded-md bg-tertiary-background px-4 py-2 text-sm font-medium text-tertiary-text hover:bg-tertiary-background/70 transition-colors"
          >
            Show prediction anyway
          </button>
        </div>
      </PredictionCard>
    );
  }

  return (
    <PredictionCard>
      {!bothRanked && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm">
          <span>⚠️</span>
          <span>{unrankedLabel} — the prediction is based on insufficient data and may be unreliable.</span>
        </div>
      )}
      <div className="flex items-center gap-3 mt-2">
        <span className="text-2xl sm:text-3xl font-bold tabular-nums w-16 text-center">
          {fmtNum(prediction.fraction * 100, { digits: 0 })}%
        </span>
        <div className="flex-1 h-3 rounded-full bg-secondary-background/30 overflow-hidden">
          <div
            className="h-full bg-secondary-background transition-all duration-500"
            style={{ width: `${prediction.fraction * 100}%` }}
          />
        </div>
        <span className="text-2xl sm:text-3xl font-bold tabular-nums w-16 text-center">
          {fmtNum((1 - prediction.fraction) * 100, { digits: 0 })}%
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <span className="text-xs text-primary-text/60">At {fmtNum(prediction.confidence * 100)}% confidence</span>
        <Link
          to={`/player/${player1}?tab=predictions&predictionTab=history&compareWith=${player2}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-tertiary-text bg-tertiary-background hover:bg-tertiary-background/70 px-3 py-1.5 rounded-full transition-colors"
        >
          Prediction history <span aria-hidden>→</span>
        </Link>
      </div>
    </PredictionCard>
  );
};

/**
 * Every game in 1 line, the newest first. The trophy is in the column of the winner,
 * so the side of the trophies shows how the 2 players compare.
 */
export const PvPGameHistory: React.FC<Props> = ({ player1, player2 }) => {
  const context = useEventDbContext();
  const { games } = context.pvp.compare(player1, player2);
  const columns =
    "grid grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_4.5rem] md:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)_6.5rem] items-center gap-1";

  return (
    <div className="rounded-2xl bg-secondary-background/20 ring-1 ring-secondary-background/40 overflow-clip">
      {/* The column headers stay on the screen while the page scrolls */}
      <div
        className={classNames(
          columns,
          "sticky top-16 md:top-12 z-10 bg-secondary-background text-secondary-text px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold",
        )}
      >
        <PlayerHeader playerId={player1} />
        <div className="text-center">Score</div>
        <PlayerHeader playerId={player2} />
        <div className="text-right">When</div>
      </div>

      {games.length === 0 ? (
        <div className="text-center py-8 text-primary-text/60">No games played yet</div>
      ) : (
        <ul className="divide-y divide-primary-text/10">
          {games.map((_, index, list) => {
            const game = list[list.length - 1 - index];
            const isPlayer1Win = game.result === "win";
            const setsWon = game.score?.setsWon;
            const player1Sets = isPlayer1Win ? setsWon?.gameWinner : setsWon?.gameLoser;
            const player2Sets = isPlayer1Win ? setsWon?.gameLoser : setsWon?.gameWinner;
            const setStrings =
              game.score?.setPoints?.map((set) =>
                isPlayer1Win ? `${set.gameWinner}-${set.gameLoser}` : `${set.gameLoser}-${set.gameWinner}`,
              ) ?? [];
            const points = Math.abs(game.pointsDiff);

            return (
              <li key={game.time}>
                <Link
                  to={`/game?time=${game.time}`}
                  className={classNames(
                    columns,
                    "px-2 sm:px-3 py-1 hover:bg-secondary-background hover:text-secondary-text transition-colors",
                  )}
                >
                  <WinnerCell won={isPlayer1Win} points={points} />
                  <div className="text-center leading-tight">
                    <span className="font-semibold tabular-nums text-sm">
                      {setsWon ? `${player1Sets} - ${player2Sets}` : "–"}
                    </span>
                    <GameMarkers score={game.score} />
                    {setStrings.length > 0 && (
                      <span className="block sm:inline sm:ml-2 text-[10px] sm:text-xs opacity-60 italic tabular-nums whitespace-nowrap">
                        {setStrings.join(", ")}
                      </span>
                    )}
                  </div>
                  <WinnerCell won={!isPlayer1Win} points={points} />
                  <div className="text-right text-[11px] sm:text-xs opacity-60 whitespace-nowrap">
                    <RelativeTime date={new Date(game.time)} variant="auto" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

const PlayerHeader: React.FC<{ playerId: string }> = ({ playerId }) => {
  const context = useEventDbContext();
  return (
    <Link
      to={`/player/${playerId}`}
      className="flex items-center justify-center gap-1.5 min-w-0 hover:underline"
      title={`Open the player page of ${context.playerName(playerId)}`}
    >
      <ProfilePicture playerId={playerId} size={20} />
      <span className="truncate">{context.playerName(playerId)}</span>
    </Link>
  );
};

const WinnerCell: React.FC<{ won: boolean; points: number }> = ({ won, points }) => (
  <div className="flex items-center justify-center gap-1">
    {won && (
      <>
        <span className="text-base sm:text-lg">🏆</span>
        <span className="text-[11px] sm:text-xs italic opacity-70 tabular-nums">
          {fmtNum(points, { signedPositive: true })}
        </span>
      </>
    )}
  </div>
);
