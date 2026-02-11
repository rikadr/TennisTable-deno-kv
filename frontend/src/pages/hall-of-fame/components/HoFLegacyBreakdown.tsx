import React from "react";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { BreakdownBar } from "./HoFShared";
import { classNames } from "../../../common/class-names";

interface HoFLegacyBreakdownProps {
   playerEntry: HallOfFameEntry;
}

export const HoFLegacyBreakdown: React.FC<HoFLegacyBreakdownProps> = ({ playerEntry }) => {
   if (!playerEntry.honors.legacyBreakdown) return null;

   const b = playerEntry.honors.legacyBreakdown;
   const total = playerEntry.honors.legacyScore;
   let runningTotal = 0;

   const contributors = [
      { label: "Peak Elo", value: b.eloScore, icon: "⚡", desc: `+1 point for every Elo point above 1000 reached` },
      { label: "Season Performance", value: b.seasonsScore, icon: "🍂", desc: `Per season: +10 participation, bonus for Top 10 (10), Top 5 (25), Top 3 (50), Win (100)` },
      {
         label: "Peak Ranking",
         value: b.peakRankScore,
         icon: "📈",
         desc: (
            <div className="flex flex-wrap gap-x-1">
               <span className="opacity-90">Peak Historical Rank:</span>
               {[
                  { label: "#1 (300)", score: 300 },
                  { label: "Top 3 (100)", score: 100 },
                  { label: "Top 5 (50)", score: 50 },
                  { label: "Top 10 (25)", score: 25 },
               ].map((item, i, arr) => (
                  <span
                     key={i}
                     className={classNames(
                        "transition-opacity",
                        b.peakRankScore === item.score ? "opacity-100 text-primary-text font-medium" : "opacity-90"
                     )}
                  >
                     {item.label}
                     {i < arr.length - 1 ? "," : ""}
                  </span>
               ))}
            </div>
         ),
      },
      { label: "Achievements Earned", value: b.achievementsScore, icon: "🎖️", desc: `+20 points for every achievement earned` },
      { label: "Social Diversity", value: b.opponentsScore, icon: "👥", desc: `+20 points for every unique opponent played against` },
      {
         label: "Tournament Progression",
         value: b.tournamentScore,
         icon: "🏆",
         desc: playerEntry.honors.tournamentProgressionCounts ? (
            <div className="flex flex-wrap gap-x-2 gap-y-1">
               <span className="opacity-90">Points:</span>
               {[
                  { label: "Win 500", count: playerEntry.honors.tournamentProgressionCounts.win },
                  { label: "Final 300", count: playerEntry.honors.tournamentProgressionCounts.final },
                  { label: "Semis 200", count: playerEntry.honors.tournamentProgressionCounts.semi },
                  { label: "Quarters 125", count: playerEntry.honors.tournamentProgressionCounts.quarter },
                  { label: "Eights 75", count: playerEntry.honors.tournamentProgressionCounts.eights },
                  { label: "Bracket 60", count: playerEntry.honors.tournamentProgressionCounts.bracket },
                  { label: "Participation 50", count: playerEntry.honors.tournamentProgressionCounts.participation },
               ].map((r, i) => (
                  <span key={i} className={classNames(
                     "transition-opacity",
                     r.count > 0 ? "opacity-100 text-primary-text font-medium" : "opacity-90"
                  )}>
                     {r.label} (x{r.count})
                  </span>
               ))}
            </div>
         ) : `Points: Win (500), Final (300), Semis (200), Quarters (125), Eights (75), Bracket (60), Participation (50)`
      },
      { label: "Longevity", value: b.longevityScore, icon: "⏳", desc: `+1 point for every active day in the league` },
      { label: "Experience", value: b.experienceScore, icon: "🎮", desc: `+3 points for every game played` },
      { label: "Data Volume", value: b.dataScore, icon: "📂", desc: `+1 point per set and +0.1 per point registered` },
   ];

   return (
      <div className="animate-in fade-in duration-300 space-y-8">
         <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
            <h3 className="text-lg font-semibold text-primary-text mb-6 flex items-center gap-2">
               <span>💎</span> Legacy Score Breakdown
            </h3>
            <p className="text-sm text-secondary-text mb-8 max-w-2xl">
               The Legacy Score is a composite metric designed to honor both peak performance and long-term contribution. The bars below show the sequential contribution of each factor to the total 100%.
            </p>

            <div className="space-y-6">
               {contributors.map((c, i) => {
                  const offset = (runningTotal / total) * 100;
                  const width = (c.value / total) * 100;
                  runningTotal += c.value;

                  return (
                     <BreakdownBar
                        key={i}
                        label={c.label}
                        value={c.value}
                        offset={offset}
                        width={width}
                        description={c.desc}
                        icon={c.icon}
                     />
                  );
               })}
            </div>

            <div className="mt-8 pt-8 border-t border-primary-text/10 flex justify-end items-baseline gap-4">
               <span className="text-sm uppercase tracking-wide text-secondary-text">Final Legacy Rating</span>
               <span className="text-4xl font-bold font-mono text-yellow-500">{playerEntry.honors.legacyScore}</span>
            </div>
         </div>
      </div>
   );
};
