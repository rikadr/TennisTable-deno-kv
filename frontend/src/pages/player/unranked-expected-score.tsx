import { useState } from "react";
import { Link } from "react-router-dom";
import { fmtNum } from "../../common/number-utils";
import { useUnrankedExpectedScoreWorker } from "../../hooks/use-unranked-expected-score-worker";

type Props = {
  playerId: string;
};

/**
 * Compact overview widget for unranked players: calculates their expected score
 * with every ranked player plus this player, like the expected leaderboard. The
 * first click arms an insufficient-data warning; the second click on the same
 * button runs the calculation.
 */
export const UnrankedExpectedScore: React.FC<Props> = ({ playerId }) => {
  const { start, result, running } = useUnrankedExpectedScoreWorker(playerId);
  const [armed, setArmed] = useState(false);

  const playerEntry = result?.expected.find((p) => p.id === playerId);

  return (
    <div className="bg-primary-background text-primary-text rounded-xl px-3 py-2 md:px-6 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h3 className="text-base font-semibold">Expected score</h3>

      {!result && !running && (
        <>
          {armed && (
            <span className="text-xs text-primary-text/80">
              ⚠️ This player is not ranked. The result is based on insufficient data and may be unreliable.
            </span>
          )}
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
              , not the current leaderboard
            </span>
            <span className="text-xs text-primary-text/60">⚠️ May be unreliable — player is not ranked</span>
          </>
        ) : (
          <span className="text-xs text-primary-text/80">
            Not enough game data to calculate an expected score for this player.
          </span>
        ))}
    </div>
  );
};
