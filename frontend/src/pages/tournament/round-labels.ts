/**
 * Names a second chance bracket round after how it is filled: even ("major") rounds receive fresh
 * losers dropping in from a first chance bracket round, odd ("minor") rounds are played among
 * second chance survivors only, to reduce the field for the next drop-in round.
 */
export function secondChanceRoundLabel(layerIndex: number, totalLayers: number): { title: string; subtitle?: string } {
  const round = totalLayers - layerIndex; // Forward round number: 1 is played first
  const winnersLayerCount = totalLayers / 2 + 1;

  if (layerIndex === 0) {
    return { title: "Second Chance Semi Final", subtitle: "Loser of the First Chance Semi Final enters" };
  }
  if (round === 1) {
    const firstChanceRound = firstChanceLayerIndexToTournamentRound(winnersLayerCount - 1);
    return {
      title: "Second Chance Round 1",
      subtitle: firstChanceRound ? `Losers from First Chance ${firstChanceRound}` : undefined,
    };
  }
  if (round % 2 === 0) {
    const firstChanceRound = firstChanceLayerIndexToTournamentRound(winnersLayerCount - 1 - round / 2);
    return {
      title: `Second Chance Round ${round}`,
      subtitle: firstChanceRound ? `Losers from First Chance ${firstChanceRound} enter` : undefined,
    };
  }
  return { title: `Second Chance Round ${round}`, subtitle: "Second chance survivors only" };
}

/**
 * Round names for the first chance bracket in double elimination, offset by one from the single
 * elimination names: the real Final is the grand final, and the second chance bracket holds the
 * other route into it, so the first chance bracket's last game is a semi final.
 */
export function firstChanceLayerIndexToTournamentRound(index: number): string | undefined {
  if (index === 0) return "Semi Final"; // A single game, so singular
  return layerIndexToTournamentRound(index + 1);
}

/** Round name for a bracket layer, using the double elimination offset when it applies */
export function bracketLayerIndexToTournamentRound(index: number, doubleElimination: boolean): string | undefined {
  return doubleElimination ? firstChanceLayerIndexToTournamentRound(index) : layerIndexToTournamentRound(index);
}

export function layerIndexToTournamentRound(index: number): string | undefined {
  switch (index) {
    case 0:
      return "Final";
    case 1:
      return "Semi Finals";
    case 2:
      return "Quarter Finals";
    case 3:
      return "8th Finals";
    case 4:
      return "16th Finals";
    case 5:
      return "32nd Finals";
    case 6:
      return "64th Finals";
    case 7:
      return "128th Finals";
    case 8:
      return "256th Finals";
    case 9:
      return "512th Finals";
  }
}
