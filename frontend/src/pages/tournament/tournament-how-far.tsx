import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { stringToColor } from "../../common/string-to-color";
import {
  chanceBeyond,
  mostFrequentStage,
  NUM_STAGE_SIMULATIONS,
  StageColumn,
  stageRank,
  stagesInColumn,
  TournamentStage,
  TournamentStagePredictionResult,
} from "../../client/client-db/tournaments/stage-prediction";
import { Tournament } from "../../client/client-db/tournaments/tournament";
import { useTournamentStagePredictionWorker } from "../../hooks/use-tournament-stage-prediction-worker";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProgressBar } from "../player/player-elo-graph";
import { ProfilePicture } from "../player/profile-picture";
import { stageLabel } from "./stage-labels";

const SIMULATION_OPTIONS: { label: string; value: number }[] = [
  { label: "Normal (5,000)", value: NUM_STAGE_SIMULATIONS },
  { label: "Heavy (15,000)", value: 15_000 },
  { label: "Extreme (50,000)", value: 50_000 },
];

type HowFarView = "all" | "player";

const VIEWS: { id: HowFarView; label: string }[] = [
  { id: "all", label: "All players" },
  { id: "player", label: "Per player" },
];

type ColumnSummary = { stage?: TournamentStage; fraction: number; beyond: number };

type PlayerRow = {
  playerId: string;
  name: string;
  knockedOut: ColumnSummary;
  firstChance?: ColumnSummary;
};

export const TournamentHowFar = ({ tournament }: { tournament: Tournament }) => {
  const context = useEventDbContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNumSimulations, setSelectedNumSimulations] = useState(NUM_STAGE_SIMULATIONS);
  const { startSimulation, result, isRunning, numSimulations } = useTournamentStagePredictionWorker();

  const view: HowFarView = searchParams.get("how-far") === "player" ? "player" : "all";
  const setView = (next: HowFarView, playerId?: string) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous);
        params.set("how-far", next);
        if (playerId) params.set("how-far-player", playerId);
        return params;
      },
      { replace: true },
    );

  const rows = useMemo(
    () => (result ? sortedRows(result, (playerId) => context.playerName(playerId)) : []),
    [result, context],
  );

  return (
    <div className="flex flex-col items-center">
      <section className="w-full max-w-[1050px] bg-primary-background rounded-lg p-2 md:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <select
            value={selectedNumSimulations}
            onChange={(e) => setSelectedNumSimulations(parseInt(e.target.value, 10))}
            disabled={isRunning}
            className="px-3 py-2 bg-secondary-background text-secondary-text font-medium rounded-lg"
          >
            {SIMULATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => startSimulation(tournament.id, selectedNumSimulations)}
            disabled={isRunning}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {result ? "Run again" : "Run Simulation"}
          </button>
        </div>
        <p className="text-xs md:text-sm text-primary-text/70 text-center">
          The app plays the rest of the tournament many times, with the win % predictions for each game. Each list shows
          how often a player leaves the tournament at each stage.
        </p>
        {isRunning && <ProgressBar progress={(result?.simulations ?? 0) / Math.max(1, numSimulations)} />}
      </section>

      {result === undefined ? (
        !isRunning && (
          <div className="w-full max-w-[1050px] mt-4 h-[200px] rounded-lg bg-gray-300/50 flex items-center justify-center text-primary-text text-center px-4">
            Click 'Run Simulation' to see how far each player will go
          </div>
        )
      ) : (
        <>
          <div className="w-full max-w-[1050px] flex space-x-2 overflow-auto mt-4">
            {VIEWS.map((option) => (
              <button
                key={option.id}
                onClick={() => setView(option.id)}
                className={classNames(
                  "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors",
                  view === option.id
                    ? "text-primary-text border-primary-text"
                    : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          {view === "all" ? (
            <AllPlayersTable result={result} rows={rows} onSelectPlayer={(playerId) => setView("player", playerId)} />
          ) : (
            <PlayerStagesView
              result={result}
              rows={rows}
              playerId={searchParams.get("how-far-player") ?? rows[0]?.playerId}
              onSelectPlayer={(playerId) => setView("player", playerId)}
            />
          )}
          <p className="w-full max-w-[1050px] text-xs md:text-sm text-primary-text/50 mt-2">
            {result.simulations < numSimulations
              ? `${result.simulations.toLocaleString()} of ${numSimulations.toLocaleString()} simulations`
              : `${result.simulations.toLocaleString()} simulations`}
          </p>
        </>
      )}
    </div>
  );
};

/**
 * Sorted by the most frequent knocked out stage, latest stage first. Inside one stage, the player
 * with the higher chance to get further comes first. Double elimination then uses the first chance column.
 */
function sortedRows(result: TournamentStagePredictionResult, playerName: (playerId: string) => string): PlayerRow[] {
  const summarize = (playerId: string, column: StageColumn): ColumnSummary => {
    const counts = result.players[playerId][column];
    const stage = mostFrequentStage(counts);
    if (!stage) return { fraction: 0, beyond: 0 };
    return {
      stage,
      fraction: (counts[stage] ?? 0) / Math.max(1, result.simulations),
      beyond: chanceBeyond(counts, stage, result.simulations),
    };
  };
  const compare = (a?: ColumnSummary, b?: ColumnSummary): number => {
    const rankA = a?.stage ? stageRank(a.stage) : -Infinity;
    const rankB = b?.stage ? stageRank(b.stage) : -Infinity;
    if (rankA !== rankB) return rankB - rankA;
    return (b?.beyond ?? 0) - (a?.beyond ?? 0);
  };

  return Object.keys(result.players)
    .map((playerId) => ({
      playerId,
      name: playerName(playerId),
      knockedOut: summarize(playerId, "knockedOut"),
      firstChance: result.doubleElimination ? summarize(playerId, "firstChance") : undefined,
    }))
    .sort(
      (a, b) =>
        compare(a.knockedOut, b.knockedOut) ||
        compare(a.firstChance, b.firstChance) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
}

const AllPlayersTable = ({
  result,
  rows,
  onSelectPlayer,
}: {
  result: TournamentStagePredictionResult;
  rows: PlayerRow[];
  onSelectPlayer: (playerId: string) => void;
}) => (
  <section className="w-full max-w-[1050px] bg-primary-background rounded-lg p-2 md:p-4">
    <div className="overflow-x-auto">
      <table className="w-full min-w-0 text-primary-text">
        <thead>
          <tr className="border-b border-secondary-background/50">
            <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">#</th>
            <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">Player</th>
            {result.doubleElimination && (
              <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">First chance</th>
            )}
            <th className="text-left py-1 px-1 md:px-2 text-xs md:text-sm">
              {result.doubleElimination ? "Knocked out" : "Most likely stage"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const newStage = i > 0 && rows[i - 1].knockedOut.stage !== row.knockedOut.stage;
            return (
              <tr
                key={row.playerId}
                onClick={() => onSelectPlayer(row.playerId)}
                className={classNames(
                  "cursor-pointer hover:bg-secondary-background/20",
                  newStage ? "border-t-2 border-secondary-background/60" : "border-t border-secondary-background/20",
                )}
              >
                <td className="py-1 px-1 md:px-2 text-xs md:text-sm text-primary-text/70">{i + 1}</td>
                <td className="py-1 px-1 md:px-2 whitespace-nowrap text-xs md:text-sm">
                  <div className="flex items-center gap-1 md:gap-2">
                    <div className="shrink-0">
                      <ProfilePicture playerId={row.playerId} size={20} border={2} />
                    </div>
                    <span className="truncate max-w-[100px] md:max-w-none">{row.name}</span>
                  </div>
                </td>
                {row.firstChance && (
                  <StageCell
                    result={result}
                    summary={row.firstChance}
                    decided={result.decided[row.playerId]?.firstChance}
                  />
                )}
                <StageCell
                  result={result}
                  summary={row.knockedOut}
                  decided={result.decided[row.playerId]?.knockedOut}
                />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    <p className="text-xs md:text-sm text-primary-text/50 mt-2">
      Each player shows the stage that occurs most often in the simulations. A ✓ marks a stage that played games already
      decide. Click a player to see all stages.
    </p>
  </section>
);

const StageCell = ({
  result,
  summary,
  decided,
}: {
  result: TournamentStagePredictionResult;
  summary: ColumnSummary;
  decided?: TournamentStage;
}) => (
  <td className="py-1 px-1 md:px-2 text-xs md:text-sm">
    {summary.stage && (
      <div className="flex flex-col md:flex-row md:items-baseline md:gap-2">
        <span className="md:whitespace-nowrap">
          {stageLabel(summary.stage, result)}
          {decided === summary.stage && " ✓"}
        </span>
        <span className="font-mono text-primary-text/60">{(summary.fraction * 100).toFixed(1)}%</span>
      </div>
    )}
  </td>
);

const PlayerStagesView = ({
  result,
  rows,
  playerId,
  onSelectPlayer,
}: {
  result: TournamentStagePredictionResult;
  rows: PlayerRow[];
  playerId?: string;
  onSelectPlayer: (playerId: string) => void;
}) => {
  const counts = playerId ? result.players[playerId] : undefined;
  return (
    <section className="w-full max-w-[1050px] bg-primary-background rounded-lg p-2 md:p-4 space-y-4">
      <select
        value={counts ? playerId : ""}
        onChange={(e) => onSelectPlayer(e.target.value)}
        className="px-3 py-2 bg-secondary-background text-secondary-text font-medium rounded-lg"
      >
        {!counts && <option value="">Select a player</option>}
        {rows.map((row) => (
          <option key={row.playerId} value={row.playerId}>
            {row.name}
          </option>
        ))}
      </select>
      {playerId && counts && (
        <>
          {result.doubleElimination && (
            <StageBars
              title="First chance bracket"
              description="Where the player leaves the first chance bracket. Final means the player wins the first chance bracket."
              result={result}
              playerId={playerId}
              column="firstChance"
            />
          )}
          <StageBars
            title="Knocked out"
            description="Where the player leaves the tournament."
            result={result}
            playerId={playerId}
            column="knockedOut"
          />
        </>
      )}
    </section>
  );
};

const StageBars = ({
  title,
  description,
  result,
  playerId,
  column,
}: {
  title: string;
  description: string;
  result: TournamentStagePredictionResult;
  playerId: string;
  column: StageColumn;
}) => {
  const counts = result.players[playerId][column];
  const decided = result.decided[playerId]?.[column];
  return (
    <div>
      <h3 className="text-primary-text font-semibold text-sm md:text-base">{title}</h3>
      <p className="text-xs md:text-sm text-primary-text/60 mb-2">{description}</p>
      <div className="space-y-2 md:space-y-1">
        {stagesInColumn(result, column).map((stage) => {
          const percent = ((counts[stage] ?? 0) / Math.max(1, result.simulations)) * 100;
          return (
            <div
              key={stage}
              className="grid grid-cols-[1fr_auto] md:grid-cols-[14rem_1fr_4rem] items-center gap-x-2 text-xs md:text-sm text-primary-text"
            >
              <span>
                {stageLabel(stage, result)}
                {decided === stage && " ✓"}
              </span>
              <span className="text-right font-mono md:order-last">{percent.toFixed(1)}%</span>
              <div className="col-span-2 md:col-span-1 bg-secondary-background/30 rounded-full h-2 md:h-3">
                <div
                  className="h-2 md:h-3 rounded-full transition-all"
                  style={{ width: `${percent}%`, backgroundColor: stringToColor(playerId) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
