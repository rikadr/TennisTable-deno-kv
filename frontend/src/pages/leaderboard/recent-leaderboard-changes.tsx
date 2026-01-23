import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { Season } from "../../client/client-db/seasons/season";

type Props = {
  view: "overall" | "season";
};

export const RecentLeaderBoardChanges: React.FC<Props> = ({ view }) => {
  const context = useEventDbContext();

  const leaderboardChanges = useMemo(() => {
    if (view === "overall") {
      return context.leaderboardChanges.leaderboardChanges();
    } else {
      // Season logic
      const seasons = context.seasons.getSeasons();
      const currentSeason = seasons.find((s) => Date.now() >= s.start && Date.now() <= s.end);

      if (currentSeason) {
        const oneWeekAgo = Date.now() - 1000 * 60 * 60 * 24 * 7;
        const sortedGames = [...currentSeason.games].sort((a, b) => a.playedAt - b.playedAt);

        const oldGames = sortedGames.filter((g) => g.playedAt <= oneWeekAgo);
        const recentGames = sortedGames.filter((g) => g.playedAt > oneWeekAgo);

        // Initialize simulation with old games
        const simSeason = new Season({ start: currentSeason.start, end: currentSeason.end });
        oldGames.forEach((g) => simSeason.addGame(g));

        let lastLeaderboard = simSeason.getLeaderboard();
        const getRankMap = (lb: ReturnType<typeof simSeason.getLeaderboard>) => {
          const map = new Map<string, number>();
          lb.forEach((p, i) => map.set(p.playerId, i + 1));
          return map;
        };

        let lastRankMap = getRankMap(lastLeaderboard);
        const changesMap = new Map<
          string,
          { currentPosition: number; netChange: number; allChanges: { change: number; time: number }[] }
        >();

        // Initialise players in map
        lastLeaderboard.forEach((p, i) => {
          changesMap.set(p.playerId, {
            currentPosition: i + 1,
            netChange: 0,
            allChanges: [],
          });
        });

        // Process recent games
        recentGames.forEach((game) => {
          simSeason.addGame(game);
          const newLeaderboard = simSeason.getLeaderboard();
          const newRankMap = getRankMap(newLeaderboard);

          newLeaderboard.forEach((p, index) => {
            const currentRank = index + 1;
            const prevRank = lastRankMap.get(p.playerId);

            if (!changesMap.has(p.playerId)) {
              // New player entered leaderboard
              changesMap.set(p.playerId, {
                currentPosition: currentRank,
                netChange: 0,
                allChanges: [],
              });
              if (prevRank === undefined) {
                // Effectively entered at bottom? Or just ignore "entry" as a change?
                // Logic in overall: netChange: prev - current.
                // If prev is undefined, maybe treat as if they were at bottom + 1?
                // For simplicity, let's skip "entry" change unless we want to assume they were last.
                // The original logic: if (leaderboardChangesMap.has(player.id) === false) ...
                // It sets netChange = prev - current where prev = leaderboard.length.
                // Let's mimic that if feasible, but "leaderboard.length" changes.
                const effectivePrev = lastLeaderboard.length + 1;
                changesMap.get(p.playerId)!.netChange = effectivePrev - currentRank;
                changesMap.get(p.playerId)!.allChanges.push({ change: effectivePrev - currentRank, time: game.playedAt });
              }
            }

            const entry = changesMap.get(p.playerId)!;

            if (prevRank !== undefined && prevRank !== currentRank) {
              const change = prevRank - currentRank;
              entry.netChange += change;
              entry.allChanges.push({ change, time: game.playedAt });
            }
            entry.currentPosition = currentRank;
          });

          lastLeaderboard = newLeaderboard;
          lastRankMap = newRankMap;
        });

        return Array.from(changesMap.values())
          .map((info) => ({
            playerId: Array.from(changesMap.keys()).find((key) => changesMap.get(key) === info)!,
            ...info,
          }))
          .filter((p) => p.allChanges.length > 0)
          .sort((a, b) => a.currentPosition - b.currentPosition);
      }
      return [];
    }
  }, [view, context]);

  if (leaderboardChanges.length === 0) {
    return null;
  }

  return (
    <div className="bg-primary-background rounded-lg ">
      <h1 className="text-2xl text-center mb-4 mt-[27.5px] text-primary-text">Leaderboard changes last 7 days</h1>
      <div className="flex flex-col divide-y divide-primary-text/50 text-primary-text">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-20 pl-5">Player</div>
          <div className="w-24 whitespace-nowrap pl-5">Current place</div>
          <div className="w-32 text-center pl-5">Changes</div>
        </div>
        {leaderboardChanges.map((player) => (
          <Link
            key={player.playerId}
            to={view === "season"
              ? `/player/${player.playerId}?tab=season`
              : `/player/${player.playerId}`
            }
            className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text py-1 px-2 flex gap-4 text-xl font-light"
          >
            <ProfilePicture playerId={player.playerId} size={28} border={2} />
            <div className="w-24 font-normal whitespace-nowrap">{context.playerName(player.playerId)}</div>
            <div className="w-10  text-right font-normal whitespace-nowrap">{fmtNum(player.currentPosition)}</div>
            <div className="w-10  text-right font-normal whitespace-nowrap">
              {fmtNum(player.netChange, { signedPositive: true })}
            </div>
            {player.allChanges.length > 1 && (
              <div className="w-24 h-fit mt-2 text-xs font-light whitespace-nowrap">
                {player.allChanges.map((c) => fmtNum(c.change, { signedPositive: true })).join(", ")}
              </div>
            )}
          </Link>
        ))}
      </div>
      { }
    </div>
  );
};
