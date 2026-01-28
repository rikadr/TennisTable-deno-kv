import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";
import { SeasonLeaderboardBars } from "./season-leaderboard-bars";
import { SeasonTimeline } from "./season-timeline";
import { SeasonScoreLog } from "./season-score-log";
import { SeasonFAQ } from "./season-faq";
import { SeasonPodium } from "./season-podium";

type SortKey = "score" | "playerPairings" | "avgPerformance";

type TabType = "leaderboard" | "bar_chart" | "timeline" | "score_log" | "faq";
const tabs: { id: TabType; label: string }[] = [
  { id: "leaderboard", label: "Leaderboard" },
  { id: "faq", label: "How it works" },
  { id: "score_log", label: "Score Log" },
  { id: "timeline", label: "Timeline" },
  { id: "bar_chart", label: "Charts" },
];

export function SeasonPage() {
  const context = useEventDbContext();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = (searchParams.get("tab") as TabType) || "leaderboard";
  
  const setActiveTab = (tab: TabType) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      newParams.set("tab", tab);
      return newParams;
    });
  };

  const { seasonStart } = useTennisParams();
  if (!seasonStart) {
    return <div className="p-6 text-primary-text">Season start time not provided</div>;
  }

  const season = context.seasons.getSeasons().find((s) => s.start === Number(seasonStart));
  if (!season) {
    return <div className="p-6 text-primary-text">Season not found for season start time: {seasonStart}</div>;
  }

  const seasonNumber = context.seasons.getSeasons().indexOf(season) + 1;
  const leaderboard = season.getLeaderboard();
  const isOngoing = Date.now() > season.start && Date.now() < season.end;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    let aVal: number;
    let bVal: number;

    switch (sortKey) {
      case "score":
        aVal = a.seasonScore;
        bVal = b.seasonScore;
        break;
      case "playerPairings":
        aVal = a.matchups.size;
        bVal = b.matchups.size;
        break;
      case "avgPerformance":
        aVal = a.seasonScore / a.matchups.size;
        bVal = b.seasonScore / b.matchups.size;
        break;
    }

    return sortDir === "asc" ? aVal - bVal : bVal - aVal;
  });

  const getSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="px-6 text-primary-text bg-primary-background">
      {/* Compact Header */}
      <div className="flex items-center gap-3 mb-3 py-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold">Season {seasonNumber}</h1>
          <p className="text-xs text-primary-text/60">
            {dateString(Number(season.start))} – {dateString(Number(season.end))}
            {Date.now() > season.end && ` · Ended ${relativeTimeString(new Date(season.end))}`}
            {Date.now() > season.start && Date.now() < season.end && ` · Ends ${relativeTimeString(new Date(season.end)).toLowerCase()}`}
            {Date.now() < season.start && ` · Starts ${relativeTimeString(new Date(season.start))}`}
          </p>
        </div>
        <Link
          to="/season/list"
          className="text-sm text-primary-text hover:text-primary-text/80 whitespace-nowrap"
        >
          ← All Seasons
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 md:space-x-2 overflow-x-auto flex-nowrap scrollbar-hide">
        {tabs.map((tab) => {
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                    flex items-center py-2 px-2 md:px-4 border-b-4 font-medium text-xs md:text-sm transition-colors shrink-0 whitespace-nowrap
                    ${
                      activeTab === tab.id
                        ? "text-primary-text border-primary-text"
                        : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted"
                    }
                  `}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {activeTab === "bar_chart" && <SeasonLeaderboardBars season={season} />}
      {activeTab === "timeline" && <SeasonTimeline season={season} />}
      {activeTab === "score_log" && <SeasonScoreLog season={season} />}
      {activeTab === "faq" && <SeasonFAQ />}
      {activeTab === "leaderboard" && (
        <div className="mt-4">
          <SeasonPodium leaderboard={leaderboard} seasonStart={Number(seasonStart)} isOngoing={isOngoing} />
          <div className="bg-secondary-background rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary-background border-b border-secondary-text/20 text-xs md:text-base">
                  <th className="text-left px-1 md:px-4 text-secondary-text font-semibold">#</th>
                  <th className="text-left px-1 md:px-4 text-secondary-text font-semibold">Player</th>
                  <th
                    className="text-left px-1 md:px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("score")}
                  >
                    <span className="md:hidden">Score</span>
                    <span className="hidden md:inline">Season Score</span>
                    {getSortIndicator("score")}
                  </th>
                  <th
                    className="text-left px-1 md:px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("playerPairings")}
                  >
                    <span className="md:hidden">Pairs</span>
                    <span className="hidden md:inline">Player Pairings</span>
                    {getSortIndicator("playerPairings")}
                  </th>
                  <th
                    className="text-left px-1 md:px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("avgPerformance")}
                  >
                    <span className="md:hidden">Avg</span>
                    <span className="hidden md:inline">Avg. Performance</span>
                    {getSortIndicator("avgPerformance")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((player, i) => {
                  const rank = leaderboard.findIndex((p) => p.playerId === player.playerId);
                  return (
                    <tr
                      key={player.playerId}
                      className="border-b border-secondary-text/10 text-secondary-text hover:bg-primary-background/50 text-xs md:text-base"
                    >
                      <td className="px-1 md:px-4">{rank + 1}</td>
                      <td className="px-1 md:px-4">
                        <Link
                          to={`/season/player?seasonStart=${seasonStart}&playerId=${player.playerId}`}
                          className="font-medium"
                        >
                          <div className="flex items-center gap-1 md:gap-3">
                            <div className="md:hidden shrink-0"><ProfilePicture playerId={player.playerId} size={22} border={2} shape="rounded" /></div>
                            <div className="hidden md:block shrink-0"><ProfilePicture playerId={player.playerId} size={35} border={3} shape="rounded" /></div>
                            {!isOngoing && rank === 0 && "🥇 "}
                            {!isOngoing && rank === 1 && "🥈 "}
                            {!isOngoing && rank === 2 && "🥉 "}
                            <span className="truncate max-w-[80px] md:max-w-none">{context.playerName(player.playerId)}</span>
                          </div>
                        </Link>
                      </td>
                      <td className="px-1 md:px-4 font-medium">{fmtNum(player.seasonScore)}</td>
                      <td className="px-1 md:px-4">{fmtNum(player.matchups.size)}</td>
                      <td className="px-1 md:px-4">{fmtNum(player.seasonScore / player.matchups.size)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
