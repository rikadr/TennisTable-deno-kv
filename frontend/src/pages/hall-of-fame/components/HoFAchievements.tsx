import React from "react";
import { PlayerAchievements } from "../../player/player-achievements";

interface HoFAchievementsProps {
   playerId: string;
}

export const HoFAchievements: React.FC<HoFAchievementsProps> = ({ playerId }) => {
   return (
      <div className="animate-in fade-in duration-300">
         <div className="bg-primary-background rounded-xl p-6 border border-primary-text/5 shadow-inner">
            <PlayerAchievements playerId={playerId} isReadOnly />
         </div>
      </div>
   );
};
