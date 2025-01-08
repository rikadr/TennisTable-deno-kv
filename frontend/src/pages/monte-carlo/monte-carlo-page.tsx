import React from "react";
import { CandelStickData, CandleStickChart } from "./candel-stick";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { Elo } from "../../client-db/elo";

export const MonteCarlo: React.FC = () => {
  const context = useClientDbContext();

  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();

  const { games, players } = context;
  const simulation = context.elo.simulateRandomGamesOrder(games, players, 10_000);

  const formattedRawData: CandelStickData[] = simulation
    .filter(({ name }) => leaderboardMap.get(name)!.games.length >= Elo.GAME_LIMIT_FOR_RANKED)
    .map(({ name, elo }, index) => ({
      name: name,
      rank: index + 1,
      high: elo.max,
      low: elo.min,
      avg: elo.avg,
      current: leaderboardMap.get(name)!.elo, // Bug when equal to avg
      time: elo.avg,
    }));

  return (
    <div className="w-full h-[600px]">
      <p>Hello from monte carlo page</p>
      <CandleStickChart rawData={formattedRawData} />
    </div>
  );
};
