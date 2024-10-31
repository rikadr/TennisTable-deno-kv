import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useClientDbContext } from "../wrappers/client-db-context";
import { PodiumPlace } from "./podium-place";
import { PlayerPointsDistrubution } from "./player-points-distribution";

export const PlayerPage: React.FC = () => {
  const { name } = useParams();
  const { width = 0 } = useWindowSize();

  const context = useClientDbContext();

  const summary = context.leaderboard.getPlayerSummary(name || "");

  const reverseGames = useMemo(() => {
    if (!summary) return;
    return summary?.games.slice(Math.max(summary?.games.length - 10, 0)).reverse();
  }, [summary]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-96 mb-4">{summary && <PodiumPlace size="default" place={summary.rank} player={summary} />}</div>

      {summary && (
        <LineChart
          width={Math.min(730, width)}
          height={250}
          data={summary?.games}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="#666" />
          <YAxis
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
          />
          <XAxis dataKey="name" />
          <Tooltip
            formatter={(value) => [value.toLocaleString("no-NO", { maximumFractionDigits: 0 }), "Elo"]}
            wrapperClassName="rounded-lg"
            animationDuration={0}
            content={<CustomTooltip />}
          />
          <Line type="monotone" dataKey="eloAfterGame" stroke="#8884d8" animationDuration={100} />

          <ReferenceLine y={1000} stroke="white" label="1 000" />
        </LineChart>
      )}
      {summary?.streaks && (
        <>
          <div className="">Longest win-streak 🔥🏆 {summary.streaks.longestWin}</div>
          <div className="">Longest lose-streak 🔥💔 {summary.streaks.longestLose}</div>
        </>
      )}
      <h1 className="text-2xl text-center mt-4">Points distribution</h1>
      <p className="mb-1">Click to compare 1v1</p>

      <div className="w-full max-w-2xl">
        <PlayerPointsDistrubution name={summary?.name} />
      </div>
      {/* <h1 className="text-2xl text-center mt-4">
        Total {summary && summary?.games.length + " games"}
      </h1> */}
      <h1 className="text-2xl text-center mt-4">Last 10 games</h1>
      <p className="mb-1">Click to go to player</p>

      <div className="flex flex-col divide-y divide-primary-text/50">
        <div className="flex gap-4 text-base text-center mb-2">
          <div className="w-32 text-left pl-2">Game</div>
          <div className="w-12 pl-4 whitespace-nowrap">Elo +-</div>
          <div className="w-32 text-right">Time</div>
        </div>
        {reverseGames?.map((game, index) => (
          <Link
            key={(summary?.name ?? "-") + index + game.oponent}
            to={`/player/${game.oponent}`}
            className="bg-primary-background hover:bg-secondary-background/30 py-1 px-2 flex gap-4 text-xl font-light"
          >
            <div className="w-32 font-normal whitespace-nowrap">
              {game.result === "win" ? "🏆 " : "💔 "} {game.oponent}
            </div>
            <div className="w-12 text-right">
              {game.pointsDiff.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="w-32 text-right text-base">{timeAgo(new Date(game.time))}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const game = payload[0].payload;
    return (
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text">
        <p className="">{`Elo : ${payload[0].value?.toLocaleString("no-NO", { maximumFractionDigits: 0 })}`}</p>
        <p className="desc">
          {game?.result === "win"
            ? `🏆 +${game.pointsDiff?.toLocaleString("no-NO", { maximumFractionDigits: 0 })} from`
            : `💔 ${game.pointsDiff?.toLocaleString("no-NO", { maximumFractionDigits: 0 })} to`}{" "}
          {game?.oponent}
        </p>
      </div>
    );
  }

  return null;
};
