import React from "react";
import { useParams, Navigate, Link, useSearchParams } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { HoFHeader } from "./components/HoFHeader";
import { HoFTabs, TabType } from "./components/HoFTabs";
import { HoFOverview } from "./components/HoFOverview";
import { HoFAchievements } from "./components/HoFAchievements";
import { HoFLegacyBreakdown } from "./components/HoFLegacyBreakdown";
import { HoFRivalries } from "./components/HoFRivalries";
import { HoFHistory } from "./components/HoFHistory";
import { HoFRawStats } from "./components/HoFRawStats";

export const HallOfFamePlayerPage: React.FC = () => {
   const { playerId } = useParams<{ playerId: string }>();
   const context = useEventDbContext();
   const [searchParams, setSearchParams] = useSearchParams();
   const activeTab = (searchParams.get("tab") as TabType) || "overview";

   const setActiveTab = (tab: TabType) => {
      setSearchParams((prev) => {
         const newParams = new URLSearchParams(prev);
         newParams.set("tab", tab);
         return newParams;
      });
   };

   const hallOfFame = context.hallOfFame?.getHallOfFame() ?? [];
   const playerEntry = hallOfFame.find((p) => p.id === playerId);

   if (!playerId || !playerEntry) {
      return <Navigate to="/hall-of-fame" />;
   }

   const isGoat = hallOfFame[0]?.id === playerId;

   return (
      <div className="max-w-7xl mx-auto px-1 md:px-4 pb-12">
         {/* Navigation Breadcrumb */}
         <div className="py-4">
            <Link
               to="/hall-of-fame"
               className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary-background/10 hover:bg-secondary-background/20 text-secondary-text/80 hover:text-secondary-text transition-colors text-sm font-medium"
            >
               <span>&larr;</span> Back to Hall of Fame
            </Link>
         </div>

         {/* Header Section */}
         <HoFHeader playerId={playerId} playerEntry={playerEntry} isGoat={isGoat} />

         {/* Tabs Navigation */}
         <HoFTabs activeTab={activeTab} setActiveTab={setActiveTab} />

         {/* Main Content Container */}
         <div className="bg-secondary-background rounded-b-2xl shadow-sm p-4 md:p-8 min-h-[400px]">
            {activeTab === "overview" && (
               <HoFOverview 
                  playerId={playerId} 
                  playerEntry={playerEntry} 
                  context={context} 
                  setActiveTab={setActiveTab} 
               />
            )}

            {activeTab === "honors" && (
               <HoFAchievements playerId={playerId} />
            )}

            {activeTab === "legacy" && (
               <HoFLegacyBreakdown playerEntry={playerEntry} />
            )}

            {activeTab === "rivalries" && (
               <HoFRivalries 
                  playerId={playerId} 
                  playerEntry={playerEntry} 
                  context={context} 
               />
            )}

            {activeTab === "history" && (
               <HoFHistory playerId={playerId} playerEntry={playerEntry} />
            )}

            {activeTab === "raw" && (
               <HoFRawStats playerEntry={playerEntry} />
            )}
         </div>
      </div>
   );
};
