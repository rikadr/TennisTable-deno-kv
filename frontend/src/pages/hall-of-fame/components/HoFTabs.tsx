import React from "react";
import { classNames } from "../../../common/class-names";

export type TabType = "overview" | "honors" | "rivalries" | "history" | "raw" | "legacy";

export const tabs: { id: TabType; label: string; icon: string }[] = [
   { id: "overview", label: "Overview", icon: "📊" },
   { id: "honors", label: "Achievements", icon: "🏆" },
   { id: "legacy", label: "Legacy Breakdown", icon: "💎" },
   { id: "rivalries", label: "Rivalries", icon: "⚔️" },
   { id: "history", label: "History", icon: "📈" },
   { id: "raw", label: "Raw Stats", icon: "🔢" },
];

interface HoFTabsProps {
   activeTab: TabType;
   setActiveTab: (tab: TabType) => void;
}

export const HoFTabs: React.FC<HoFTabsProps> = ({ activeTab, setActiveTab }) => {
   return (
      <div className="bg-secondary-background px-4 md:px-8 border-b border-primary-text/10">
         <div className="flex space-x-6 overflow-x-auto flex-nowrap scrollbar-hide">
            {tabs.map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={classNames(
                     "flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                     activeTab === tab.id
                        ? "text-primary-text border-primary-text"
                        : "text-secondary-text/60 border-transparent hover:text-secondary-text hover:border-secondary-text/30"
                  )}
               >
                  <span>{tab.icon}</span>
                  {tab.label}
               </button>
            ))}
         </div>
      </div>
   );
};
