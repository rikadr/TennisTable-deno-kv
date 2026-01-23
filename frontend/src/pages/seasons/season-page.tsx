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
      <div className="bg-secondary-background text-secondary-text rounded-lg px-4 py-2 mb-2 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Season {seasonNumber}</h1>
        <div className="flex flex-col items-end text-sm">
          <span className="font-medium">
            {dateString(Number(season.start))} → {dateString(Number(season.end))}
          </span>
          <span className="text-xs opacity-70">
            {Date.now() > season.end && `Ended ${relativeTimeString(new Date(season.end))}`}
            {Date.now() > season.start &&
              Date.now() < season.end &&
              `Started ${relativeTimeString(new Date(season.start))}, ends ${relativeTimeString(new Date(season.end)).toLowerCase()}`}
            {Date.now() < season.start && `Starts ${relativeTimeString(new Date(season.start))}`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 overflow-x-auto flex-nowrap scrollbar-hide">
        {tabs.map((tab) => {
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                    flex items-center py-2 px-4 border-b-4 font-medium text-sm transition-colors shrink-0 whitespace-nowrap
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
        <div className="bg-secondary-background rounded-lg overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-secondary-background border-b border-secondary-text/20">
                  <th className="text-left px-4 text-secondary-text font-semibold">#</th>
                  <th className="text-left px-4 text-secondary-text font-semibold">Player</th>
                  <th
                    className="text-left px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80"
                    onClick={() => handleSort("score")}
                  >
                    Season Score{getSortIndicator("score")}
                  </th>
                  <th
                    className="text-left px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80"
                    onClick={() => handleSort("playerPairings")}
                  >
                    Player Pairings{getSortIndicator("playerPairings")}
                  </th>
                  <th
                    className="text-left px-4 text-secondary-text font-semibold cursor-pointer hover:text-secondary-text/80"
                    onClick={() => handleSort("avgPerformance")}
                  >
                    Avg. Performance{getSortIndicator("avgPerformance")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedLeaderboard.map((player, i) => {
                  const rank = leaderboard.findIndex((p) => p.playerId === player.playerId);
                  return (
                    <tr
                      key={player.playerId}
                      className="border-b border-secondary-text/10 text-secondary-text hover:bg-primary-background/50"
                    >
                      <td className="px-4">{rank + 1}</td>
                      <td className="px-4">
                        <Link
                          to={`/season/player?seasonStart=${seasonStart}&playerId=${player.playerId}`}
                          className="font-medium"
                        >
                          <div className="flex items-center gap-3">
                            <ProfilePicture playerId={player.playerId} size={35} border={3} shape="rounded" />
                            {rank === 0 && "🥇 "}
                            {rank === 1 && "🥈 "}
                            {rank === 2 && "🥉 "}
                            {context.playerName(player.playerId)}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 font-medium">{fmtNum(player.seasonScore)}</td>
                      <td className="px-4">{fmtNum(player.matchups.size)}</td>
                      <td className="px-4">{fmtNum(player.seasonScore / player.matchups.size)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
