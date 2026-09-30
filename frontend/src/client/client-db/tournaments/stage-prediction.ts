import { TennisTable } from "../tennis-table";
import { PredictionMethod } from "./tournament";

/**
 * The stage where a player leaves a tournament, or a double elimination first chance bracket.
 * - `winner`: won the tournament
 * - `final`: lost the final. In the first chance column: won the first chance bracket
 * - `bracket:<layerIndex>`: lost a game in this layer of the (first chance) bracket
 * - `second:<layerIndex>`: lost a game in this layer of the second chance bracket
 * - `group:<place>`: finished at this place in the total group play standings and did not qualify for the bracket
 */
export type TournamentStage = "winner" | "final" | `bracket:${number}` | `second:${number}` | `group:${number}`;

/** A double elimination player has a first chance stage. Every player gets a knocked out stage */
export type PlayerStages = { firstChance?: TournamentStage; knockedOut?: TournamentStage };

export type TournamentStages = {
  players: Map<string, PlayerStages>;
  winnersLayerCount: number;
  losersLayerCount: number;
};

export type StageCounts = Partial<Record<TournamentStage, number>>;
export type StageColumn = "knockedOut" | "firstChance";

export type TournamentStagePredictionResult = {
  /**
   * How many simulations these counts are based on. Less than the planned number while still
   * running. The counts are expected counts, so with an exact result they are chances.
   */
  simulations: number;
  /** 1 for an exact result, else the requested number */
  plannedSimulations: number;
  method: PredictionMethod;
  doubleElimination: boolean;
  winnersLayerCount: number;
  losersLayerCount: number;
  players: Record<string, Record<StageColumn, StageCounts>>;
  /** The stages that the played games already decide */
  decided: Record<string, PlayerStages>;
};

export const NUM_STAGE_SIMULATIONS = 5_000;
const PARTIAL_RESULT_INTERVAL = 1_000;

export class TournamentStagePrediction {
  private readonly parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  /** Predicts the rest of the tournament from its current state and adds up the chance of each stage for each player */
  predictStages(
    tournamentId: string,
    numSimulations: number = NUM_STAGE_SIMULATIONS,
    onPartialResult?: (result: TournamentStagePredictionResult) => void,
  ): TournamentStagePredictionResult {
    const tournament = this.parent.tournaments.getTournament(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament not found: ${tournamentId}`);
    }

    const decidedStages = tournament.getDecidedStages();
    const result: TournamentStagePredictionResult = {
      simulations: 0,
      plannedSimulations: numSimulations,
      method: "simulation",
      doubleElimination: tournament.tournamentConfig.doubleElimination,
      winnersLayerCount: decidedStages.winnersLayerCount,
      losersLayerCount: decidedStages.losersLayerCount,
      players: {},
      decided: Object.fromEntries(decidedStages.players),
    };

    const time = Date.now();
    for (let i = 0; i < result.plannedSimulations; i++) {
      const stages = tournament.predictStageChances(this.parent, time);
      if (i === 0) {
        result.method = stages.method;
        // A hybrid result keeps all the samples. The group play places come only from the simulation,
        // so fewer samples make them less accurate.
        if (stages.method === "exact") result.plannedSimulations = 1;
      }
      result.winnersLayerCount = stages.winnersLayerCount;
      result.losersLayerCount = stages.losersLayerCount;
      stages.players.forEach((chances, player) => {
        const counts = (result.players[player] ??= { knockedOut: {}, firstChance: {} });
        add(counts.knockedOut, chances.knockedOut);
        add(counts.firstChance, chances.firstChance);
      });
      result.simulations = i + 1;

      if (
        onPartialResult &&
        result.simulations % PARTIAL_RESULT_INTERVAL === 0 &&
        result.simulations < result.plannedSimulations
      ) {
        onPartialResult(copyResult(result));
      }
    }
    return result;
  }
}

function add(counts: StageCounts, chances: StageCounts) {
  for (const [stage, chance] of stageEntries(chances)) counts[stage] = (counts[stage] ?? 0) + chance;
}

/** The counts keep changing while the simulation runs, so a partial result gets its own copy */
function copyResult(result: TournamentStagePredictionResult): TournamentStagePredictionResult {
  return {
    ...result,
    players: Object.fromEntries(
      Object.entries(result.players).map(([player, counts]) => [
        player,
        { knockedOut: { ...counts.knockedOut }, firstChance: { ...counts.firstChance } },
      ]),
    ),
  };
}

/** A higher rank is a later stage. Only stages in the same column compare */
export function stageRank(stage: TournamentStage): number {
  if (stage === "winner") return 2_000;
  if (stage === "final") return 1_999;
  const [kind, value] = stage.split(":");
  const index = Number(value);
  if (kind === "group") return -index; // A lower place is better
  return 1_000 - index; // bracket and second chance: layer 0 is the last round before the final
}

/** The stage that occurs most often. A tie goes to the later stage */
export function mostFrequentStage(counts: StageCounts): TournamentStage | undefined {
  let best: TournamentStage | undefined;
  let bestCount = 0;
  for (const [stage, count] of stageEntries(counts)) {
    if (count > bestCount || (count === bestCount && best !== undefined && stageRank(stage) > stageRank(best))) {
      best = stage;
      bestCount = count;
    }
  }
  return best;
}

/** The fraction of simulations where the player got further than this stage */
export function chanceBeyond(counts: StageCounts, stage: TournamentStage, simulations: number): number {
  const rank = stageRank(stage);
  const beyond = stageEntries(counts)
    .filter(([other]) => stageRank(other) > rank)
    .reduce((sum, [, count]) => sum + count, 0);
  return beyond / Math.max(1, simulations);
}

/** All stages of a column that occur for any player, plus the stages at the top, latest stage first */
export function stagesInColumn(result: TournamentStagePredictionResult, column: StageColumn): TournamentStage[] {
  const stages = new Set<TournamentStage>(column === "knockedOut" ? ["winner", "final"] : ["final"]);
  for (const counts of Object.values(result.players)) {
    for (const [stage] of stageEntries(counts[column])) stages.add(stage);
  }
  return [...stages].sort((a, b) => stageRank(b) - stageRank(a));
}

function stageEntries(counts: StageCounts): [TournamentStage, number][] {
  return Object.entries(counts) as [TournamentStage, number][];
}
