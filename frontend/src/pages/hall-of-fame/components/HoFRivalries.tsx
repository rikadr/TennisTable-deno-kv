import React from "react";
import { HallOfFameEntry } from "../../../client/client-db/hall-of-fame";
import { ContentCard } from "../../player/player-page";
import { RivalryCard } from "./HoFShared";
import { PlayerGamesDistrubution } from "../../player/player-games-distribution";

interface HoFRivalriesProps {
   playerId: string;
   playerEntry: HallOfFameEntry;
   context: any;
}

export const HoFRivalries: React.FC<HoFRivalriesProps> = ({ playerId, playerEntry, context }) => {
   return (
      <div className="space-y-6 animate-in fade-in duration-300">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {playerEntry.honors.nemesis && (
               <ContentCard title="Arch Nemesis" description="Most losses against">
                  <RivalryCard type="nemesis" opponentId={playerEntry.honors.nemesis.id} count={playerEntry.honors.nemesis.losses} context={context} full />
               </ContentCard>
            )}
            {playerEntry.honors.favoriteVictim && (
               <ContentCard title="Favorite Victim" description="Most wins against">
                  <RivalryCard type="victim" opponentId={playerEntry.honors.favoriteVictim.id} count={playerEntry.honors.favoriteVictim.wins} context={context} full />
               </ContentCard>
            )}
         </div>
         <ContentCard title="Opponent Frequency" description="Who you played the most">
            <PlayerGamesDistrubution playerId={playerId} />
         </ContentCard>
      </div>
   );
};
