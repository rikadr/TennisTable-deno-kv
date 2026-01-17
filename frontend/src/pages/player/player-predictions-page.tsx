import { useState } from "react";
import { PlayerPredictionsList } from "./player-predictions-list";
import { PlayerPredictionsHistory } from "./players-predictions-history";
import { classNames } from "../../common/class-names";

type TabType = "details" | "history";
const tabs: { id: TabType; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "history", label: "History" },
];

type Props = {
  playerId: string;
};

export const PlayerPredictionsPage = ({ playerId }: Props) => {
  const [activeTab, setActiveTab] = useState<TabType>("details");

  return (
    <div className="flex flex-col h-full sm:-mt-4 md:-mt-8">
      {/* Tabs */}
      <div className="bg-secondary-background  px-0 mb-4">
        <div className="flex space-x-2 overflow-auto">
          {tabs.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={classNames(
                  "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors",
                  activeTab === tab.id
                    ? "text-secondary-text border-secondary-text"
                    : "text-secondary-text/80 border-transparent hover:text-secondary-text hover:border-secondary-text border-dotted",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
      {activeTab === "details" && <PlayerPredictionsList playerId={playerId} />}
      {activeTab === "history" && <PlayerPredictionsHistory playerId={playerId} />}
    </div>
  );
};
