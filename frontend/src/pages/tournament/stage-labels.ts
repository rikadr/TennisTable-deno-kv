import { TournamentStage, TournamentStagePredictionResult } from "../../client/client-db/tournaments/stage-prediction";
import {
  firstChanceLayerIndexToTournamentRound,
  layerIndexToTournamentRound,
  secondChanceRoundLabel,
} from "../leaderboard/tournament-pending-games";

type LabelContext = Pick<
  TournamentStagePredictionResult,
  "doubleElimination" | "winnersLayerCount" | "losersLayerCount"
>;

/** The name of a stage, as the bracket tabs name its round */
export function stageLabel(stage: TournamentStage, context: LabelContext): string {
  if (stage === "winner") return "Winner";
  if (stage === "final") return "Final";
  const [kind, value] = stage.split(":");
  const index = Number(value);
  switch (kind) {
    case "group":
      return `Group play (${ordinal(index)} in group)`;
    case "second":
      return secondChanceRoundLabel(index, context.losersLayerCount).title;
    default: {
      if (context.doubleElimination) {
        return `First Chance ${firstChanceLayerIndexToTournamentRound(index) ?? `Round ${context.winnersLayerCount - index}`}`;
      }
      return layerIndexToTournamentRound(index) ?? `Round ${context.winnersLayerCount - index}`;
    }
  }
}

function ordinal(value: number): string {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}
