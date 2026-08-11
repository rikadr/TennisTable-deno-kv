import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { classNames } from "../../common/class-names";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString, relativeTimeString } from "../../common/date-utils";
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
  const navigate = useNavigate();
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
              className={classNames(
                "flex items-center py-2 px-2 md:px-4 border-b-4 font-medium text-xs md:text-sm transition-colors shrink-0 whitespace-nowrap",
                activeTab === tab.id
                  ? "text-primary-text border-primary-text"
                  : "text-primary-text/80 border-transparent hover:text-primary-text hover:border-primary-text border-dotted",
              )}
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
          <div className="bg-secondary-background rounded-lg overflow-hidden max-w-md mx-auto">
            <table className="w-full text-secondary-text border-collapse">
              <thead className="border-b border-secondary-text/50">
                <tr className="text-xs xs:text-sm sm:text-base text-secondary-text">
                  <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-normal">#</th>
                  <th className="py-1 px-1 xs:px-2 md:px-3 text-left font-medium">Player</th>
                  <th
                    className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("score")}
                  >
                    Score
                    {getSortIndicator("score")}
                  </th>
                  <th
                    className="py-1 px-1 xs:px-2 md:px-3 text-right font-normal cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("playerPairings")}
                  >
                    Pairs
                    {getSortIndicator("playerPairings")}
                  </th>
                  <th
                    className="py-1 px-1 xs:px-2 md:px-3 text-right font-normal cursor-pointer hover:text-secondary-text/80 whitespace-nowrap"
                    onClick={() => handleSort("avgPerformance")}
                  >
                    Avg
                    {getSortIndicator("avgPerformance")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-text/50">
                {sortedLeaderboard.map((player) => {
                  const rank = leaderboard.findIndex((p) => p.playerId === player.playerId);
                  return (
                    <tr
                      key={player.playerId}
                      onClick={() => navigate(`/season/player?seasonStart=${seasonStart}&playerId=${player.playerId}`)}
                      className="text-secondary-text hover:bg-primary-background/50 cursor-pointer transition-colors text-xs xs:text-sm sm:text-base"
                    >
                      <td className="py-1 px-1 xs:px-2 md:px-3 w-[1%] whitespace-nowrap">{rank + 1}</td>
                      <td className="py-1 px-1 xs:px-2 md:px-3 w-full max-w-0">
                        <div className="flex items-center gap-1 md:gap-3 min-w-0">
                          <div className="md:hidden shrink-0"><ProfilePicture playerId={player.playerId} size={22} border={2} shape="rounded" /></div>
                          <div className="hidden md:block shrink-0"><ProfilePicture playerId={player.playerId} size={35} border={3} shape="rounded" /></div>
                          {!isOngoing && rank === 0 && "🥇 "}
                          {!isOngoing && rank === 1 && "🥈 "}
                          {!isOngoing && rank === 2 && "🥉 "}
                          <span className="font-medium truncate">{context.playerName(player.playerId)}</span>
                        </div>
                      </td>
                      <td className="py-1 px-1 xs:px-2 md:px-3 text-right font-medium w-[1%] whitespace-nowrap">
                        {fmtNum(player.seasonScore)}
                      </td>
                      <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap">
                        {fmtNum(player.matchups.size)}
                      </td>
                      <td className="py-1 px-1 xs:px-2 md:px-3 text-right w-[1%] whitespace-nowrap">
                        {fmtNum(player.seasonScore / player.matchups.size)}
                      </td>
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
