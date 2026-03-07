import React from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { RelativeTime } from "../../common/date-utils";

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
          Honoring the players who shaped our community through their dedication, competitive spirit, and lasting contributions to the table tennis community.
        </p>
        {entries.length === 0 ? (
          <p className="text-secondary-background text-sm text-center pb-4">No retired players yet.</p>
        ) : (
          <table className="w-full text-primary-text">
            <thead>
              <tr className="text-base">
                <th className="text-left py-2 px-2 font-normal w-8">#</th>
                <th className="text-left py-2 px-2 font-normal">Name</th>
                <th className="text-center py-2 px-2 font-normal whitespace-nowrap">Hall of Fame Score</th>
                <th className="text-right py-2 px-2 font-normal">Retired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-text/50">
              {entries.map((entry, index) => {
                const player = context.eventStore.playersProjector.getPlayer(entry.playerId);
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
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">{fmtNum(entry.score.total)}</td>
                    <td className="py-2 px-2 text-right text-sm whitespace-nowrap">
                      {player?.updatedAt && <RelativeTime date={new Date(player.updatedAt)} />}
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
