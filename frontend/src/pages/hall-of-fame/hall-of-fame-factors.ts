import { HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";

/** The score sections, in the order they are shown to the player. */
export const FACTORS: { key: HallOfFameFactorKey; emoji: string; name: string }[] = [
  { key: "peakElo", emoji: "🔥", name: "All-Time High" },
  { key: "podiumTime", emoji: "🥉", name: "Time at the Top" },
  { key: "experience", emoji: "🏓", name: "Experience" },
  { key: "dataVolume", emoji: "📊", name: "Data Volume" },
  { key: "longevity", emoji: "📅", name: "Activity" },
  { key: "seasonPerformance", emoji: "🍁", name: "Seasons" },
  { key: "tournamentProgression", emoji: "🏆", name: "Tournaments" },
  { key: "socialDiversity", emoji: "👥", name: "Social Diversity" },
  { key: "achievementsEarned", emoji: "🎖️", name: "Achievements" },
];
