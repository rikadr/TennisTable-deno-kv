import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";

/** The score sections, in the order they are shown to the player.
 *
 * The colors are validated as a set for colorblind-safe separation between
 * neighbours in this exact order, on both light and dark theme surfaces.
 * Keep color and order in sync: the score-over-time graph stacks the
 * sections in this order, first section on top, so a reorder or a new
 * color needs revalidation. */
export const FACTORS: { key: HallOfFameFactorKey; emoji: string; name: string; color: string }[] = [
  { key: "peakElo", emoji: "🔥", name: "All-Time High", color: "#3987e5" },
  { key: "podiumTime", emoji: "🥉", name: "Time at the Top", color: "#d95926" },
  { key: "experience", emoji: "🏓", name: "Experience", color: "#199e70" },
  { key: "dataVolume", emoji: "📊", name: "Data Volume", color: "#c98500" },
  { key: "longevity", emoji: "📅", name: "Activity", color: "#d55181" },
  { key: "seasonPerformance", emoji: "🍁", name: "Seasons", color: "#079207" },
  { key: "tournamentProgression", emoji: "🏆", name: "Tournaments", color: "#9085e9" },
  { key: "socialDiversity", emoji: "👥", name: "Social Diversity", color: "#e66767" },
  { key: "achievementsEarned", emoji: "🎖️", name: "Achievements", color: "#0891b2" },
];
