import { Link } from "react-router-dom";
import { useState } from "react";
import { ProfilePicture } from "../player/profile-picture";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { fmtNum } from "../../common/number-utils";
import { useTennisParams } from "../../hooks/use-tennis-params";
import { dateString } from "../player/player-achievements";
import { relativeTimeString } from "../../common/date-utils";

type SortKey = "score" | "playerPairings" | "avgPerformance";

export function SeasonPage() {
  const context = useEventDbContext();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { seasonStart } = useTennisParams();
  if (!seasonStart) {
    return <div className="p-6 text-primary-text">Season start time not provided</div>;
  }

  const season = context.seasons.getSeasons().find((s) => s.start === Number(seasonStart));
  if (!season) {
    return <div className="p-6 text-primary-text">Season not found for season start time: {seasonStart}</div>;
  }

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
    <div className="px-6">
      <h1>Season Leaderboard</h1>
      <h2>
        {dateString(Number(season.start))} to {dateString(Number(season.end))}
      </h2>
      {Date.now() > season.end && "Ended " + relativeTimeString(new Date(season.end))}
      {Date.now() > season.start && Date.now() < season.end && "Started " + relativeTimeString(new Date(season.start))}
      {Date.now() < season.start && "Starts " + relativeTimeString(new Date(season.start))}

      <div className="bg-secondary-background rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-treasury-background border-b border-treasury-text/20">
              <th className="text-left px-4 text-treasury-text font-semibold">Rank</th>
              <th className="text-left px-4 text-treasury-text font-semibold">Player</th>
              <th
                className="text-left px-4 text-treasury-text font-semibold cursor-pointer hover:text-treasury-text/80"
                onClick={() => handleSort("score")}
              >
                Season Score{getSortIndicator("score")}
              </th>
              <th
                className="text-left px-4 text-treasury-text font-semibold cursor-pointer hover:text-treasury-text/80"
                onClick={() => handleSort("playerPairings")}
              >
                Player Pairings{getSortIndicator("playerPairings")}
              </th>
              <th
                className="text-left px-4 text-treasury-text font-semibold cursor-pointer hover:text-treasury-text/80"
                onClick={() => handleSort("avgPerformance")}
              >
                Avg. Performance{getSortIndicator("avgPerformance")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.map((player, i) => (
              <tr key={player.playerId} className="border-b border-secondary-text/10 hover:bg-primary-background/50">
                <td className="px-4 text-secondary-text">{i + 1}</td>
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <ProfilePicture playerId={player.playerId} size={40} />
                    <Link
                      to={`/player/${player.playerId}`}
                      className="text-primary-text hover:text-treasury-text font-medium"
                    >
                      {context.playerName(player.playerId)}
                    </Link>
                  </div>
                </td>
                <td className="px-4 text-primary-text font-medium">{fmtNum(player.seasonScore)}</td>
                <td className="px-4 text-secondary-text">{fmtNum(player.matchups.size)}</td>
                <td className="px-4 text-secondary-text">{fmtNum(player.seasonScore / player.matchups.size)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
