import React from "react";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { DetailCard } from "./HoFShared";
import { ACHIEVEMENT_LABELS } from "../../player/player-achievements";
import { PlayerEloGraph } from "../../player/player-elo-graph";
import { TabType } from "./HoFTabs";

interface HoFOverviewProps {
   playerId: string;
   playerEntry: HallOfFameEntry;
   context: any;
   setActiveTab: (tab: TabType) => void;
}

export const HoFOverview: React.FC<HoFOverviewProps> = ({ playerId, playerEntry, context, setActiveTab }) => {
   return (
      <div className="space-y-8 animate-in fade-in duration-300">
         {/* Highlight Stats Grid */}
         <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <DetailCard label="Total Games" value={playerEntry.honors.totalGames} icon="🎮" />
            <DetailCard label="Peak Rank" value={playerEntry.honors.peakRank ? `#${playerEntry.honors.peakRank}` : "N/A"} icon="📈" />
            <DetailCard label="Days Active" value={playerEntry.honors.daysActive} icon="⏳" />
            <DetailCard label="Longest Streak" value={playerEntry.honors.longestStreak} icon="🔥" />
            <DetailCard label="Avg Season Rank" value={`#${playerEntry.honors.averageSeasonRank || "-"}`} icon="📊" />
         </div>

         {/* Career Milestones Teaser */}
         <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
            <h3 className="font-semibold text-primary-text flex items-center gap-2 mb-6">
               <span>✨</span> Career Highlights
            </h3>
            <div className="relative">
               <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary-text/10" />
               <div className="space-y-6">
                  {playerEntry.honors.milestones.slice(-3).toReversed().map((m, i) => (
                     <div key={i} className="relative pl-10">
                        <div className="absolute left-0 w-8 h-8 rounded-full bg-secondary-background border border-primary-text/20 flex items-center justify-center text-sm z-10">
                           {m.icon}
                        </div>
                        <div>
                           <div className="text-sm font-bold text-primary-text">{m.label}</div>
                           <div className="text-xs text-secondary-text/60">{new Date(m.date).toLocaleDateString()}</div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Tournament Highlights */}
         {playerEntry.honors.tournamentStats && playerEntry.honors.tournamentStats.participated > 0 && (
            <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
               <div className="flex items-baseline justify-between mb-4">
                  <h3 className="font-semibold text-primary-text flex items-center gap-2">
                     <span>🏆</span> Tournament Career
                  </h3>
                  {playerEntry.honors.knockoutStats && playerEntry.honors.knockoutStats.played > 0 && (
                     <div className="text-xs font-medium text-secondary-text bg-secondary-background/10 px-2 py-1 rounded">
                        Knockout Win Rate: <span className="text-primary-text">{playerEntry.honors.knockoutStats.winRate}%</span> ({playerEntry.honors.knockoutStats.won}/{playerEntry.honors.knockoutStats.played})
                     </div>
                  )}
               </div>
               <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                     <div className="text-3xl font-bold text-yellow-500">{playerEntry.honors.tournamentStats.won}</div>
                     <div className="text-xs uppercase tracking-wide opacity-70">Wins</div>
                  </div>
                  <div>
                     <div className="text-3xl font-bold text-primary-text">{playerEntry.honors.tournamentStats.finals}</div>
                     <div className="text-xs uppercase tracking-wide opacity-70">Finals</div>
                  </div>
                  <div>
                     <div className="text-3xl font-bold text-primary-text">{playerEntry.honors.tournamentStats.participated}</div>
                     <div className="text-xs uppercase tracking-wide opacity-70">Played</div>
                  </div>
               </div>
            </div>
         )}

         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Achievements Teaser */}
            <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary-text flex items-center gap-2">
                     <span>🏆</span> Achievements
                  </h3>
                  <button onClick={() => setActiveTab("honors")} className="text-xs text-secondary-text hover:underline">View All &rarr;</button>
               </div>
               <div className="grid grid-cols-4 gap-2">
                  {context.achievements.getAchievements(playerId).slice(0, 8).map((ach: any, i: number) => (
                     <div key={i} className="aspect-square rounded-lg bg-secondary-background/10 flex items-center justify-center text-2xl" title={ach.type}>
                        {ACHIEVEMENT_LABELS[ach.type]?.icon || '🏅'}
                     </div>
                  ))}
               </div>
            </div>

            {/* Legacy Curve Teaser */}
            <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-primary-text flex items-center gap-2">
                     <span>📈</span> Legacy Curve
                  </h3>
                  <button onClick={() => setActiveTab("history")} className="text-xs text-secondary-text hover:underline">Full History &rarr;</button>
               </div>
               <div className="h-40 -mx-4">
                  <PlayerEloGraph playerId={playerId} isReadOnly />
               </div>
            </div>
         </div>
      </div>
   );
};
