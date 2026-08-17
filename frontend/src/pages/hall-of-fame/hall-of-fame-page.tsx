import React from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime } from "../../common/date-utils";
import { isRecentlyRetired } from "./recently-retired";

export const HallOfFamePage: React.FC = () => {
  const context = useEventDbContext();
  const navigate = useNavigate();
  const entries = context.hallOfFame.getHallOfFame();
  const activePlayers = [...context.players].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return (
    <div className="w-full px-4 flex flex-col items-center gap-4">
      <div className="bg-primary-background rounded-lg w-full max-w-xl">
        <h1 className="text-2xl text-center text-primary-text mt-4 mb-1">Hall of Fame</h1>
        <p className="text-primary-text text-sm text-center mb-4">
          Honoring the retired players who shaped our community through their dedication, competitive spirit, and lasting contributions to the table tennis community.
        </p>
        {entries.length === 0 ? (
          <p className="text-secondary-background text-sm text-center pb-4">No retired players yet.</p>
        ) : (
          <table className="w-full text-primary-text border-collapse">
            <thead className="border-b border-primary-text/50">
              <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
                <th className="py-1 px-2 text-left font-light">#</th>
                <th className="py-1 px-2 text-left font-normal">Player</th>
                <th className="py-1 px-2 text-right font-light whitespace-nowrap">HOF Score</th>
                <th className="py-1 px-2 text-right font-light text-xs xs:text-sm md:text-base">Retired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-text/50">
              {entries.map((entry, index) => {
                const player = context.eventStore.playersProjector.getPlayer(entry.playerId);
                return (
                  <tr
                    key={entry.playerId}
                    onClick={() => navigate(`/hall-of-fame/${entry.playerId}`)}
                    className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
                  >
                    <td className="py-1 px-2 italic w-[1%] whitespace-nowrap">{index + 1}</td>
                    <td className="py-1 px-2 w-full max-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <ProfilePicture playerId={entry.playerId} size={28} border={2} />
                        <span className="font-normal truncate">{entry.playerName}</span>
                        {player && isRecentlyRetired(player) && (
                          <span className="bg-secondary-background text-secondary-text text-xs px-2 py-0.5 rounded-full font-normal shrink-0">
                            Recent
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-2 text-right w-[1%] whitespace-nowrap">{fmtNum(entry.score.total)}</td>
                    <td className="py-1 px-2 text-right text-xs xs:text-sm md:text-base w-[1%] whitespace-nowrap">
                      {player?.updatedAt && <RelativeTime date={new Date(player.updatedAt)} variant="auto" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Check hypothetical score */}
      <div className="bg-primary-background rounded-lg w-full max-w-xl p-4">
        <h2 className="text-lg text-primary-text font-semibold text-center mb-2">What would my score be?</h2>
        <p className="text-primary-text text-sm text-center mb-3">Check your hypothetical Hall of Fame score</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {activePlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => navigate(`/hall-of-fame/${player.id}`)}
              className="bg-secondary-background text-secondary-text px-3 py-1.5 rounded-lg text-sm font-medium hover:opacity-80 transition-opacity inline-flex items-center gap-2"
            >
              <ProfilePicture playerId={player.id} size={20} border={1} />
              {player.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
