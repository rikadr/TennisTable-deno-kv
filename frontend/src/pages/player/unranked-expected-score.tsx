import { fmtNum } from "../../common/number-utils";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { useUnrankedExpectedScoreWorker } from "../../hooks/use-unranked-expected-score-worker";
import { ContentCard } from "./content-card";

type Props = {
  playerId: string;
};

/**
 * Overview card for unranked players: a button (behind an insufficient-data
 * warning) that simulates their expected score by letting every ranked player
 * plus this player play each other, like the expected leaderboard.
 */
export const UnrankedExpectedScore: React.FC<Props> = ({ playerId }) => {
  const context = useEventDbContext();
  const { start, result, progress, running } = useUnrankedExpectedScoreWorker(playerId);

  const playerEntry = result?.expected.find((p) => p.id === playerId);

  return (
    <ContentCard title="Expected score">
      <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-primary-text">
        {!result && !running && (
          <div className="text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <p className="text-lg font-semibold mb-1">This player is not ranked</p>
            <p className="text-sm text-primary-text/80 mb-4">
              A simulated score is based on insufficient data and may be unreliable.
            </p>
            <button
              onClick={start}
              className="rounded-md bg-tertiary-background px-4 py-2 text-sm font-medium text-tertiary-text hover:bg-tertiary-background/70 transition-colors"
            >
              Simulate expected score anyway
            </button>
          </div>
        )}

        {running && (
          <div className="text-center">
            <p className="text-sm text-primary-text/80 mb-4">Simulating 5 000 leaderboards…</p>
            <div className="h-2.5 w-full rounded-full bg-primary-text/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-secondary-background transition-all duration-150"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <p className="text-primary-text/60 text-xs mt-2">{Math.round(progress * 100)} %</p>
          </div>
        )}

        {result &&
          !running &&
          (playerEntry ? (
            <div>
              <div className="flex flex-wrap gap-2 sm:gap-4">
                <div className="flex-1 min-w-40 bg-primary-background rounded-lg p-4">
                  <p className="text-sm mb-1">Expected score</p>
                  <p className="text-2xl font-bold">{fmtNum(playerEntry.score)}</p>
                </div>
                <div className="flex-1 min-w-40 bg-primary-background rounded-lg p-4">
                  <p className="text-sm mb-1">Expected rank</p>
                  <p className="text-2xl font-bold">
                    {fmtNum(playerEntry.rank)} <span className="text-base font-light">of {result.expected.length}</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-primary-text/80 mt-3">
                ⚠️ The average of 5 000 simulated leaderboards where every ranked player and{" "}
                {context.playerName(playerId)} play each other. {context.playerName(playerId)} is not ranked, so the
                result is based on insufficient data and may be unreliable.
              </p>
            </div>
          ) : (
            <p className="text-sm text-primary-text/80 text-center">
              Not enough game data to simulate an expected score for this player.
            </p>
          ))}
      </div>
    </ContentCard>
  );
};
