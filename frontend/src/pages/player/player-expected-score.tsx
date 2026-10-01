import { useState } from "react";
import { Link } from "react-router-dom";
import { fmtNum } from "../../common/number-utils";
import { usePlayerExpectedScoreWorker } from "../../hooks/use-player-expected-score-worker";
import { useEventDbContext } from "../../wrappers/event-db-context";

type Props = {
  playerId: string;
  /** A retired player is put back among the active players for the calculation */
  retired: boolean;
};

/**
 * Compact overview widget for unranked and retired players: calculates their expected score
 * with every ranked player plus this player, like the expected leaderboard. The first click
 * arms a warning about the data; the second click on the same button runs the calculation.
 */
export const PlayerExpectedScore: React.FC<Props> = ({ playerId, retired }) => {
  const context = useEventDbContext();
  const { start, result, running } = usePlayerExpectedScoreWorker(playerId);
  const [armed, setArmed] = useState(false);

  const gameLimit = context.client.gameLimitForRanked;
  const tooFewGames = context.leaderboard.getPlayerSummary(playerId).games.length < gameLimit;
  const warnings = [
    retired && "This player is retired. The calculation uses old games, so the result can be out of date.",
    tooFewGames &&
      `This player has played fewer than ${gameLimit} games. The result is based on insufficient data and may be unreliable.`,
  ].filter((warning): warning is string => !!warning);
  const shortWarning = retired ? "player is retired" : "player is not ranked";

  const playerEntry = result?.expected.find((p) => p.id === playerId);

  return (
    <div className="bg-primary-background text-primary-text rounded-xl px-3 py-2 md:px-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h3 className="text-base font-semibold">Expected score</h3>

      {!result && !running && (
        <>
          {armed &&
            warnings.map((warning) => (
              <span key={warning} className="text-xs text-primary-text/80">
                ⚠️ {warning}
              </span>
            ))}
          <button
            onClick={() => (armed ? start() : setArmed(true))}
            className="rounded-md bg-tertiary-background px-3 py-1.5 text-xs font-medium text-tertiary-text hover:bg-tertiary-background/70 transition-colors"
          >
            {armed ? "Calculate anyway" : "Calculate"}
          </button>
        </>
      )}

      {running && <span className="text-xs text-primary-text/60">Calculating…</span>}

      {result &&
        !running &&
        (playerEntry ? (
          <>
            <span>
              <span className="text-xl font-bold">{fmtNum(playerEntry.score)}</span>{" "}
              <span className="text-sm font-light">points</span>
            </span>
            <span className="text-sm">
              rank {fmtNum(playerEntry.rank)} of {result.expected.length} on the{" "}
              <Link to="/simulations/expected-leaderboard" className="underline hover:text-primary-text/70">
                expected leaderboard
              </Link>
              {retired ? ", if the player played against the active players today" : ", not the current leaderboard"}
            </span>
            <span className="text-xs text-primary-text/60">⚠️ May be unreliable — {shortWarning}</span>
          </>
        ) : (
          <span className="text-xs text-primary-text/80">
            Not enough game data to calculate an expected score for this player.
          </span>
        ))}
    </div>
  );
};
