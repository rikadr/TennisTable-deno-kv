import React from "react";
import { CandelStickData, CandleStickChart } from "./candel-stick";
import { useEventDbContext } from "../../../wrappers/event-db-context";

export const MonteCarlo: React.FC = () => {
  const context = useEventDbContext();

  const leaderboardMap = context.leaderboard.getCachedLeaderboardMap();
  const simulation = context.simulations.monteCarloSimulation(10_000);

  const formattedRawData: CandelStickData[] = simulation
    .filter(({ name }) => (leaderboardMap.get(name)?.games.length || 0) >= context.client.gameLimitForRanked)
    .map(({ name, elo }, index) => ({
      name: name,
      rank: index + 1,
      high: elo.max,
      low: elo.min,
      avg: elo.avg,
      current: leaderboardMap.get(name)!.elo, // Bug when equal to avg
      time: elo.avg,
    }))
    .sort((a, b) => b.current - a.current);
  return (
    <div>
      <div className="mx-8">
        <h1>Monte Carlo simulation</h1>
        <p>Find the expected score of the players, compared to their actual score!</p>
      </div>
      <div className="w-full h-[600px]">
        <CandleStickChart rawData={formattedRawData} />
      </div>

      <section className="mx-8 pt-10">
        <h1>How it works</h1>
        <p>It runs 10 000 simulations.</p>
        <p>
          Each simulation takes all the games with results, shuffle in random order, and simulating everyone's scores
          after all the games.
        </p>
        <h1 className="pt-6">How to read</h1>
        <p>
          The grapth is a common{" "}
          <a className="underline" href="https://www.investopedia.com/trading/candlestick-charting-what-is-it/">
            candle stick graph 🔗
          </a>
        </p>
        <p>It shows the players MAX and MIN simulated scores in the protruding "canlde wicks"</p>
        <p>The "canlde body" compares the simulated average to the player's actual score.</p>
        <br />
        <p>
          <span className="text-green-500">GREEN</span> means lucky 🍀 Your current score is higher than the expected
          avg score.
        </p>
        <p>
          <span className="text-red-500">RED</span> means unlycky 🔻 Your current score is lower than the expected avg
          score.
        </p>
      </section>
    </div>
  );
};
