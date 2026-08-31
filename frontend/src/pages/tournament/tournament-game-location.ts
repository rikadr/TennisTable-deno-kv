import { GameLocation } from "../../client/client-db/tournaments/tournament-connections";
import { TournamentGamePlacement } from "../../client/client-db/tournaments/tournament";
import { bracketLayerIndexToTournamentRound, secondChanceRoundLabel } from "../leaderboard/tournament-pending-games";

/**
 * A link to one game on the tournament page. The tab has to come along, or the link would land on
 * whichever tab the reader is already on. The player pair makes the page scroll the game's card
 * into view and wiggle it once it is there.
 */
export function tournamentGameLink(tournamentId: string, game: GameLocation): string {
  const tab = (() => {
    if (game.where === "group") return "group-play";
    if (game.section === "losers") return "second-chance";
    if (game.section === "grandFinal" || game.section === "bracketReset") return "grand-final";
    return "finals";
  })();
  const params = new URLSearchParams({
    tournament: tournamentId,
    player1: game.player1,
    player2: game.player2,
    tab,
  });
  return `/tournament?${params.toString()}`;
}

/**
 * How a game's place in a tournament reads: the part of the tournament it was played in, named
 * after the tab that holds it, and the round or the group inside that part.
 */
export function tournamentPlacementLabels(placement: TournamentGamePlacement): { stage: string; round: string } {
  if (placement.where === "group") {
    return { stage: "Group play", round: `Group ${placement.groupIndex + 1}` };
  }
  if (placement.section === "grandFinal") {
    return { stage: "Final", round: "Final" };
  }
  if (placement.section === "bracketReset") {
    return { stage: "Final", round: "The Final Decider" };
  }
  if (placement.section === "losers") {
    return {
      stage: "Second chance bracket",
      round: secondChanceRoundLabel(placement.layerIndex, placement.layerCount).title,
    };
  }
  return {
    stage: placement.doubleElimination ? "First chance bracket" : "Finals",
    round: bracketLayerIndexToTournamentRound(placement.layerIndex, placement.doubleElimination) ?? "Bracket",
  };
}
