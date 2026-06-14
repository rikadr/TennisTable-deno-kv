import { useState } from "react";
import { PlayerPredictionsList } from "./player-predictions-list";
import { PlayerPredictionsHistory } from "./players-predictions-history";
import { classNames } from "../../common/class-names";
import { useSearchParams } from "react-router-dom";

type TabType = "details" | "history";
const tabs: { id: TabType; label: string }[] = [
  { id: "history", label: "History" },
  { id: "details", label: "Details" },
];

type Props = {
  playerId: string;
  isRanked: boolean;
};

export const PlayerPredictionsPage = ({ playerId, isRanked }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("predictionTab") as TabType) || "history";

  // Unranked players are gated behind a warning. They can choose to reveal the
  // predictions anyway, after which a persistent banner keeps reminding them the
  // data is insufficient.
  const [revealed, setRevealed] = useState(false);

  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("predictionTab", tab);
      return newParams;
    });
  };

  if (!isRanked && !revealed) {
    return (
      <div className="flex flex-col h-full sm:-mt-4 md:-mt-8">
        <div className="mx-auto my-8 max-w-md rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-center text-secondary-text">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-lg font-semibold mb-1">This player is not ranked</p>
          <p className="text-sm text-secondary-text/80 mb-4">
            Predictions are based on insufficient data and may be unreliable.
          </p>
          <button
            onClick={() => setRevealed(true)}
            className="rounded-md bg-tertiary-background px-4 py-2 text-sm font-medium text-tertiary-text hover:bg-tertiary-background/70 transition-colors"
          >
            Show predictions anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full sm:-mt-4 md:-mt-8">
      {!isRanked && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 text-sm text-secondary-text">
          <span>⚠️</span>
          <span>This player is not ranked — predictions are based on insufficient data and may be unreliable.</span>
        </div>
      )}
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
