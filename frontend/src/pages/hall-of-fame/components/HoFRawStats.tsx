import React from "react";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { DetailCard } from "./HoFShared";

interface HoFRawStatsProps {
   playerEntry: HallOfFameEntry;
}

export const HoFRawStats: React.FC<HoFRawStatsProps> = ({ playerEntry }) => {
   return (
      <div className="animate-in fade-in duration-300 space-y-8">
         <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
            <h3 className="text-lg font-semibold text-primary-text mb-6 flex items-center gap-2">
               <span>🔢</span> Aggregate Statistics
            </h3>
            {playerEntry.honors.rawStats ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Sets Stats */}
                  <div className="space-y-4">
                     <div className="flex justify-between items-baseline border-b border-primary-text/10 pb-2">
                        <h4 className="text-sm uppercase tracking-wide text-primary-text/60 font-bold">Sets</h4>
                        <span className="text-xs font-mono text-primary-text/40">Total: {playerEntry.honors.rawStats.setsWon + playerEntry.honors.rawStats.setsLost}</span>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <DetailCard label="Sets Won" value={playerEntry.honors.rawStats.setsWon} icon="👍" />
                        <DetailCard label="Sets Lost" value={playerEntry.honors.rawStats.setsLost} icon="👎" />
                     </div>
                     <div className="flex flex-col gap-1 text-xs text-center text-primary-text/50">
                        <div>Set Win Rate: {Math.round((playerEntry.honors.rawStats.setsWon / (playerEntry.honors.rawStats.setsWon + playerEntry.honors.rawStats.setsLost)) * 100) || 0}%</div>
                        <div>Registered in {Math.round((playerEntry.honors.rawStats.gamesWithSets / playerEntry.honors.rawStats.gamesPlayed) * 100)}% of games</div>
                        <div className="mt-2 pt-2 border-t border-primary-text/10 font-medium italic text-primary-text/70">
                           Estimated Career Sets: {playerEntry.honors.rawStats.estimatedTotalSets}
                        </div>
                     </div>
                  </div>

                  {/* Points Stats */}
                  <div className="space-y-4">
                     <div className="flex justify-between items-baseline border-b border-primary-text/10 pb-2">
                        <h4 className="text-sm uppercase tracking-wide text-primary-text/60 font-bold">Points</h4>
                        <span className="text-xs font-mono text-primary-text/40">Total: {playerEntry.honors.rawStats.pointsScored + playerEntry.honors.rawStats.pointsConceded}</span>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <DetailCard label="Points Scored" value={playerEntry.honors.rawStats.pointsScored} icon="🟢" />
                        <DetailCard label="Points Conceded" value={playerEntry.honors.rawStats.pointsConceded} icon="🔴" />
                     </div>
                     <div className="flex flex-col gap-1 text-xs text-center text-primary-text/50">
                        <div>Point Ratio: {(playerEntry.honors.rawStats.pointsScored / (playerEntry.honors.rawStats.pointsConceded || 1)).toFixed(2)}</div>
                        <div>Registered in {Math.round((playerEntry.honors.rawStats.gamesWithPoints / playerEntry.honors.rawStats.gamesPlayed) * 100)}% of games</div>
                        <div className="mt-2 pt-2 border-t border-primary-text/10 font-medium italic text-primary-text/70">
                           Estimated Career Points: {playerEntry.honors.rawStats.estimatedTotalPoints}
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="text-center text-secondary-text py-12 italic">
                  No raw game data available.
               </div>
            )}
         </div>
      </div>
   );
};
