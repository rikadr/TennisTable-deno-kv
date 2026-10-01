import React from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { DashboardCard } from "./dashboard-card";
import { DashboardSeasonState, LeaderboardView } from "./dashboard-season";

const rowClassName =
  "bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light";

const PlayerCell: React.FC<{ playerId: string }> = ({ playerId }) => {
  const context = useEventDbContext();
  return (
    <td className="py-1 px-1 xs:px-2 w-full max-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <ProfilePicture playerId={playerId} size={28} border={2} />
        <span className="font-normal truncate">{context.playerName(playerId)}</span>
      </div>
    </td>
  );
};

/** Players who are not on the leaderboard of the selected view */
export const UnrankedPlayersCard: React.FC<{ view: LeaderboardView; season: DashboardSeasonState }> = ({
  view,
  season,
}) => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  if (view === "season") {
    if (!season.currentSeason) return null;
    const participantIds = new Set(season.currentSeason.getLeaderboard().map((p) => p.playerId));
    const playersNotInSeason = context.players
      .filter((player) => !participantIds.has(player.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (playersNotInSeason.length === 0) return null;

    return (
      <DashboardCard
        title="Not in the season yet"
        subtitle="Play a game this season to join the leaderboard"
        className="pb-1"
      >
        <table className="w-full text-primary-text border-collapse">
          <tbody className="divide-y divide-primary-text/50">
            {playersNotInSeason.map((player) => (
              <tr key={player.id} onClick={() => navigate(`/player/${player.id}?tab=season`)} className={rowClassName}>
                <PlayerCell playerId={player.id} />
              </tr>
            ))}
          </tbody>
        </table>
      </DashboardCard>
    );
  }

  const leaderboard = context.leaderboard.getLeaderboard();
  const playersWithNoGames = context.players.filter(
    (player) =>
      !leaderboard.rankedPlayers.some((r) => r.id === player.id) &&
      !leaderboard.unrankedPlayers.some((u) => u.id === player.id),
  );
  if (leaderboard.unrankedPlayers.length === 0 && playersWithNoGames.length === 0) return null;

  return (
    <DashboardCard
      title="Unranked players"
      subtitle={`Play ${context.client.gameLimitForRanked} or more games to get ranked`}
      className="pb-1"
    >
      <table className="w-full text-primary-text border-collapse">
        <thead className="border-b border-primary-text/50">
          <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
            <th className="py-1 px-1 xs:px-2 text-left font-normal">Player</th>
            <th className="py-1 px-1 xs:px-2 text-right font-light">Elo</th>
            <th className="py-1 px-1 xs:px-2 text-right font-light">Games</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-text/50">
          {leaderboard.unrankedPlayers.map((player) => (
            <tr key={player.id} onClick={() => navigate(`/player/${player.id}`)} className={rowClassName}>
              <PlayerCell playerId={player.id} />
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{fmtNum(player.elo)}</td>
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">{player.games.length}</td>
            </tr>
          ))}
          {playersWithNoGames.map((player) => (
            <tr key={player.id} onClick={() => navigate(`/player/${player.id}`)} className={rowClassName}>
              <PlayerCell playerId={player.id} />
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">-</td>
              <td className="py-1 px-1 xs:px-2 text-right w-[1%] whitespace-nowrap">0</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DashboardCard>
  );
};
