import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";

export const HallOfFameLeaderboardPage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const entries = context.hallOfFame.getFullHypotheticalLeaderboard();

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
        {entries.length === 0 ? (
          <p className="text-secondary-background text-sm text-center pb-4">No players yet.</p>
        ) : (
          <table className="w-full text-primary-text">
            <thead>
              <tr className="text-base">
                <th className="text-left py-2 px-2 font-normal w-8">#</th>
                <th className="text-left py-2 px-2 font-normal">Name</th>
                <th className="text-right py-2 px-2 font-normal whitespace-nowrap">Hall of Fame Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-text/50">
              {entries.map((entry, index) => {
                const player = context.eventStore.playersProjector.getPlayer(entry.playerId);
                const isActive = player?.active ?? false;
                return (
                  <tr
                    key={entry.playerId}
                    onClick={() => navigate(`/hall-of-fame/${entry.playerId}`)}
                    className="cursor-pointer hover:bg-secondary-background hover:text-secondary-text text-xl font-light"
                  >
                    <td className="py-2 px-2 italic">{index + 1}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-3 font-normal whitespace-nowrap">
                        <ProfilePicture playerId={entry.playerId} size={28} border={2} />
                        {entry.playerName}
                        {!isActive && (
                          <span className="bg-secondary-background text-secondary-text text-xs px-2 py-0.5 rounded-full font-normal">
                            Retired
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right">{fmtNum(entry.score.total)}</td>
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
