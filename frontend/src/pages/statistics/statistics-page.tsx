import React from "react";
import { useSearchParams } from "react-router-dom";
import { classNames } from "../../common/class-names";
import { TimeRange, TIME_RANGES } from "../../common/time-range";
import { ActivityTab } from "./activity-tab";
import { GamesTab } from "./games-tab";
import { LeagueTab } from "./league-tab";
import { MatchupsTab } from "./matchups-tab";
import { GapView } from "./statistics-aggregations";

type Tab = "activity" | "games" | "matchups" | "league";
const TABS: { id: Tab; label: string }[] = [
  { id: "activity", label: "Activity" },
  { id: "games", label: "Games" },
  { id: "matchups", label: "Matchups" },
  { id: "league", label: "League" },
];

const GAP_VIEWS: GapView[] = ["all", "wins", "losses"];

export const StatisticsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const setParams = (updates: Record<string, string | undefined>) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      });
      return next;
    });
  };

  const tabParam = searchParams.get("tab");
  const activeTab: Tab = TABS.some((tab) => tab.id === tabParam) ? (tabParam as Tab) : "activity";

  const rangeParam = searchParams.get("range");
  const range: TimeRange = TIME_RANGES.includes(rangeParam as TimeRange) ? (rangeParam as TimeRange) : "all";

  const viewParam = searchParams.get("view");
  const gapView: GapView = GAP_VIEWS.includes(viewParam as GapView) ? (viewParam as GapView) : "all";

  return (
    <div className="w-full px-2 md:px-4 flex flex-col items-center">
      <div className="w-full max-w-2xl md:max-w-4xl flex flex-col gap-4">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl text-primary-text">Statistics</h1>
          <p className="text-sm md:text-base text-primary-text/70 mt-1">
            How the league plays: the shares, the medians and the pace of the whole league. The page never shows how
            many games one player plays.
          </p>
        </div>

        <div className="flex justify-center space-x-2 overflow-x-auto flex-nowrap scrollbar-hide border-b border-primary-text/20">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setParams({ tab: tab.id })}
              className={classNames(
                "flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors shrink-0 whitespace-nowrap",
                activeTab === tab.id
                  ? "text-primary-text border-primary-text"
                  : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "activity" && <ActivityTab />}
        {activeTab === "games" && <GamesTab range={range} setRange={(value) => setParams({ range: value })} />}
        {activeTab === "matchups" && (
          <MatchupsTab view={gapView} setView={(value) => setParams({ view: value })} />
        )}
        {activeTab === "league" && <LeagueTab />}
      </div>
    </div>
  );
};
