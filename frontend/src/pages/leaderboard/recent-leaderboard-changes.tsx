import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEventDbContext } from "../../wrappers/event-db-context";
import { ProfilePicture } from "../player/profile-picture";
import { fmtNum } from "../../common/number-utils";
import { Season } from "../../client/client-db/seasons/season";

type Props = {
  view: "overall" | "season";
};

export const RecentLeaderBoardChanges: React.FC<Props> = ({ view }) => {
  const context = useEventDbContext();
  const navigate = useNavigate();

  const leaderboardChanges = useMemo(() => {
    if (view === "overall") {
      return context.leaderboardChanges.leaderboardChanges();
    } else {
      // Season logic
      const seasons = context.seasons.getSeasons();
      const currentSeason = seasons.find((s) => Date.now() >= s.start && Date.now() <= s.end);

      if (currentSeason) {
        const twoDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 2;
        const sortedGames = [...currentSeason.games].sort((a, b) => a.playedAt - b.playedAt);

        const oldGames = sortedGames.filter((g) => g.playedAt <= twoDaysAgo);
        const recentGames = sortedGames.filter((g) => g.playedAt > twoDaysAgo);

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
                changesMap
                  .get(p.playerId)!
                  .allChanges.push({ change: effectivePrev - currentRank, time: game.playedAt });
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
    <div className="bg-primary-background rounded-lg w-full overflow-hidden">
      <h1 className="text-2xl text-center mb-2 mt-3 text-primary-text">Leaderboard changes last 2 days</h1>
      <table className="w-full text-primary-text border-collapse">
        <thead>
          <tr className="text-sm xs:text-lg md:text-xl text-primary-text">
            <th className="py-1 px-2 text-left font-normal">Player</th>
            <th className="py-1 pl-1 pr-3 font-normal w-[1%]">
              {/* Zero-width so the label doesn't widen the hug column; overflows leftward */}
              <div className="w-0 ml-auto whitespace-nowrap" dir="rtl">
                <bdi dir="ltr">Place</bdi>
              </div>
            </th>
            <th className="py-1 px-1 font-normal w-[1%]">
              {/* Overflows rightward into the empty detail header */}
              <div className="w-0 whitespace-nowrap">Changes</div>
            </th>
            <th className="py-1 px-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-text/50">
          {leaderboardChanges.map((player) => (
            <tr
              key={player.playerId}
              onClick={() =>
                navigate(view === "season" ? `/player/${player.playerId}?tab=season` : `/player/${player.playerId}`)
              }
              className="bg-primary-background hover:bg-secondary-background hover:text-secondary-text cursor-pointer transition-colors text-sm xs:text-lg md:text-xl font-light"
            >
              <td className="py-1 px-2 w-[55%] max-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <ProfilePicture playerId={player.playerId} size={28} border={2} />
                  <span className="font-normal truncate">{context.playerName(player.playerId)}</span>
                </div>
              </td>
              <td className="py-1 pl-1 pr-3 text-right font-normal w-[1%] whitespace-nowrap">
                {fmtNum(player.currentPosition)}
              </td>
              <td className="py-1 px-1 text-right font-normal w-[1%] whitespace-nowrap">
                {fmtNum(player.netChange, { signedPositive: true })}
              </td>
              <td className="py-1 px-2 w-[45%] max-w-0 text-xs xs:text-sm md:text-base">
                {player.allChanges.length > 1 && (
                  // dir="rtl" puts the ellipsis on the left so the most recent
                  // (last) entries stay readable; <bdi dir="ltr"> keeps the
                  // characters themselves in normal order.
                  <div className="truncate" dir="rtl">
                    <bdi dir="ltr">
                      {player.allChanges.map((c) => fmtNum(c.change, { signedPositive: true })).join(", ")}
                    </bdi>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
