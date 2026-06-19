import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { classNames } from "../../common/class-names";
import { HallOfFameEntry, HallOfFameFactorKey } from "../../client/client-db/hall-of-fame";
import { FACTORS } from "./hall-of-fame-player-page";

type CategoryOption = HallOfFameFactorKey | "all";
type SortBy = "category" | "total";

export const HallOfFameLeaderboardPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const entries = context.hallOfFame.getFullHypotheticalLeaderboard();

  const [selectedCategory, setSelectedCategory] = useState<CategoryOption>("all");
  const [sortBy, setSortBy] = useState<SortBy>("category");

  const isCategory = selectedCategory !== "all";
  const selectedFactor = FACTORS.find((f) => f.key === selectedCategory);

  const displayedScore = (entry: HallOfFameEntry): number =>
    selectedCategory === "all" ? entry.score.total : entry.score[selectedCategory].score;

  // getFullHypotheticalLeaderboard() already returns entries sorted by total score.
  const sortedEntries = useMemo(() => {
    if (selectedCategory === "all" || sortBy === "total") {
      return entries;
    }
    return [...entries].sort((a, b) => b.score[selectedCategory].score - a.score[selectedCategory].score);
  }, [entries, selectedCategory, sortBy]);

  // Highest displayed score, used to size the relative bar on each row.
  const maxScore = useMemo(() => {
    return sortedEntries.reduce((max, entry) => {
      const score = selectedCategory === "all" ? entry.score.total : entry.score[selectedCategory].score;
      return Math.max(max, score);
    }, 0);
  }, [sortedEntries, selectedCategory]);

  return (
    <div className="w-full px-4 flex flex-col items-center">
      <div className="bg-primary-background rounded-lg w-full max-w-xl">
        <div className="flex items-center gap-4 px-4 pt-4">
          <Link to="/hall-of-fame" className="text-primary-text hover:underline text-sm">
            &larr; Back
          </Link>
        </div>
        <h1 className="text-2xl text-center text-primary-text mt-2 mb-1">Full Hypothetical Leaderboard</h1>
        <p className="text-primary-text text-sm text-center mb-4 px-4">
          Hall of Fame scores for every player — both retired and currently active. Scores for active players are
          hypothetical and will keep changing as they keep playing.
        </p>

        {/* Category filter + sort toggle */}
        <div className="flex flex-wrap items-center justify-center gap-3 px-4 mb-4">
          <div className="flex items-center gap-2">
            <label htmlFor="hof-category" className="text-primary-text text-sm">
              Category:
            </label>
            <select
              id="hof-category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CategoryOption)}
              className="px-3 py-2 bg-secondary-background text-secondary-text border border-primary-text rounded text-sm min-w-[180px]"
            >
              <option value="all">🏅 Total score</option>
              {FACTORS.map((factor) => (
                <option key={factor.key} value={factor.key}>
                  {factor.emoji} {factor.name}
                </option>
              ))}
            </select>
          </div>

          {isCategory && (
            <div role="tablist" aria-label="Sort by" className="inline-flex bg-secondary-background rounded-full p-1">
              {(
                [
                  { value: "category" as const, label: `${selectedFactor?.name ?? "Category"} score` },
                  { value: "total" as const, label: "Total score" },
                ]
              ).map((option) => {
                const active = sortBy === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSortBy(option.value)}
                    className={classNames(
                      "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                      active
                        ? "bg-tertiary-background text-tertiary-text shadow-sm"
                        : "text-secondary-text hover:text-primary-text",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {sortedEntries.length === 0 ? (
          <p className="text-secondary-background text-sm text-center pb-4">No players yet.</p>
        ) : (
          <table className="w-full text-primary-text">
            <thead>
              <tr className="text-base">
                <th className="text-left py-2 px-2 font-normal w-8">#</th>
                <th className="text-left py-2 px-2 font-normal">Name</th>
                <th className="text-right py-2 px-2 font-normal whitespace-nowrap">
                  {isCategory ? `${selectedFactor?.emoji ?? ""} ${selectedFactor?.name ?? "Score"}` : "Hall of Fame Score"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-text/50">
              {sortedEntries.map((entry, index) => {
                const player = context.eventStore.playersProjector.getPlayer(entry.playerId);
                const isActive = player?.active ?? false;
                const score = displayedScore(entry);
                const relativePercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
                return (
                  <tr
                    key={entry.playerId}
                    onClick={() => navigate(`/hall-of-fame/${entry.playerId}`)}
                    className="cursor-pointer hover:bg-secondary-background hover:text-secondary-text text-xl font-light"
                  >
                    <td className="py-2 px-2 italic">{index + 1}</td>
                    <td className="py-2 px-2 relative overflow-hidden">
                      <div className="flex items-center gap-3 font-normal whitespace-nowrap">
                        <ProfilePicture playerId={entry.playerId} size={28} border={2} />
                        {entry.playerName}
                        {!isActive && (
                          <span className="bg-secondary-background text-secondary-text text-xs px-2 py-0.5 rounded-full font-normal">
                            Retired
                          </span>
                        )}
                      </div>
                      <div
                        className="absolute bottom-0 left-0 h-[2px] bg-current"
                        style={{ width: `${relativePercent}%` }}
                      />
                    </td>
                    <td className="py-2 px-2 text-right">
                      {fmtNum(score)}
                      {isCategory && (
                        <span className="text-primary-text/50 text-sm ml-1.5">/ {fmtNum(entry.score.total)} total</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
