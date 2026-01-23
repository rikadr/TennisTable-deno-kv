import React from "react";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { ContentCard } from "../../player/player-page";
import { ActivityHeatmap } from "./HoFShared";
import { PlayerEloGraph } from "../../player/player-elo-graph";

interface HoFHistoryProps {
   playerId: string;
   playerEntry: HallOfFameEntry;
}

export const HoFHistory: React.FC<HoFHistoryProps> = ({ playerId, playerEntry }) => {
   return (
      <div className="animate-in fade-in duration-300 space-y-8">
         {/* Activity Heatmap */}
         <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5">
            <h3 className="text-lg font-semibold text-primary-text mb-4 flex items-center gap-2">
               <span>🔥</span> Activity Heatmap
            </h3>
            <ActivityHeatmap data={playerEntry.honors.activityHeatmap} />
         </div>

         <ContentCard title="Elo History" description="Complete career rating progression">
            <div className="bg-primary-background rounded-lg -mx-2 mt-4 p-2 h-[500px]">
               <PlayerEloGraph playerId={playerId} isReadOnly />
            </div>
         </ContentCard>
      </div>
   );
};
