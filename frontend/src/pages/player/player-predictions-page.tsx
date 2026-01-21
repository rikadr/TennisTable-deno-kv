import { PlayerPredictionsList } from "./player-predictions-list";
import { PlayerPredictionsHistory } from "./players-predictions-history";
import { classNames } from "../../common/class-names";
import { useSearchParams } from "react-router-dom";

type TabType = "details" | "history";
const tabs: { id: TabType; label: string }[] = [
  { id: "details", label: "Details" },
  { id: "history", label: "History" },
];

type Props = {
  playerId: string;
};

export const PlayerPredictionsPage = ({ playerId }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("predictionTab") as TabType) || "details";

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("predictionTab", tab);
      return newParams;
    });
  };

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
