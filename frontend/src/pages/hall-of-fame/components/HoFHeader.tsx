import React from "react";
import { ProfilePicture } from "../../player/profile-picture";
import { classNames } from "../../../common/class-names";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { StatItem } from "./HoFShared";

interface HoFHeaderProps {
   playerId: string;
   playerEntry: HallOfFameEntry;
   isGoat: boolean;
}

export const HoFHeader: React.FC<HoFHeaderProps> = ({ playerId, playerEntry, isGoat }) => {
   return (
      <div className={classNames(
         "relative rounded-t-2xl overflow-hidden p-8 text-primary-text shadow-xl z-10",
         isGoat
            ? "bg-gradient-to-br from-yellow-600/90 via-yellow-900/80 to-primary-background border-b-4 border-yellow-500"
            : "bg-gradient-to-br from-primary-background via-secondary-background/20 to-primary-background border-b border-primary-text/10"
      )}>
         {/* Decorative Background Elements */}
         <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl select-none pointer-events-none grayscale">
            🏆
         </div>

         <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            <div className="relative group shrink-0">
               <div className={classNames(
                  "absolute -inset-1 rounded-full blur opacity-75 transition duration-1000 group-hover:duration-200",
                  isGoat ? "bg-gradient-to-r from-yellow-400 to-amber-600" : "bg-gradient-to-r from-secondary-background to-primary-background"
               )}></div>
               <div className="relative">
                  <ProfilePicture playerId={playerId} size={160} border={isGoat ? 4 : 2} />
                  {isGoat && (
                     <div className="absolute top-[-3%] left-[-3%] -translate-x-1/2 -translate-y-1/2 text-5xl rotate-[-20deg] drop-shadow-lg filter z-20">👑</div>
                  )}
               </div>
            </div>

            <div className="flex-1 text-center md:text-left min-w-0">
               <div className="flex flex-col md:flex-row items-center gap-3 mb-2 justify-center md:justify-start">
                  <h1 className="text-4xl md:text-6xl font-bold tracking-tight truncate max-w-full">{playerEntry.name}</h1>
                  {isGoat && (
                     <span className="shrink-0 px-3 py-1 bg-yellow-500 text-black border border-yellow-400 rounded text-xs font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(234,179,8,0.4)]">
                        The G.O.A.T
                     </span>
                  )}
               </div>

               {/* Titles & Play Styles */}
               <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                  {playerEntry.titles.map((title, i) => (
                     <span key={i} className="px-2 py-1 bg-primary-text/5 text-primary-text/90 text-sm rounded border border-primary-text/10 backdrop-blur-sm">
                        {title}
                     </span>
                  ))}
                  {playerEntry.honors.playStyle?.map((style, i) => (
                     <span key={`style-${i}`} className="px-2 py-1 bg-indigo-500/20 text-indigo-200 text-sm rounded border border-indigo-500/30 backdrop-blur-sm font-medium">
                        {style}
                     </span>
                  ))}
               </div>

               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mt-6 border-t border-primary-text/10 pt-6">
                  <StatItem label="Peak Elo" value={playerEntry.honors.peakElo} highlight={isGoat} />
                  <StatItem label="Win Rate" value={`${playerEntry.honors.winRate}%`} />

                  <StatItem
                     label="Legacy Score"
                     value={playerEntry.honors.legacyScore}
                     highlight
                     subtext="Composite Rating"
                  />

                  {playerEntry.honors.tournamentStats && playerEntry.honors.tournamentStats.participated > 0 && (
                     <StatItem
                        label="Tournaments"
                        value={playerEntry.honors.tournamentStats.won}
                        subtext={`Wins / ${playerEntry.honors.tournamentStats.participated} Played`}
                        highlight={playerEntry.honors.tournamentStats.won > 0}
                     />
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};
