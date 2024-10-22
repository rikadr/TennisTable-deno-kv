import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useClientDbContext } from "../wrappers/client-db-context";

export const PlayerPage: React.FC = () => {
  const { name } = useParams();
  const { width = 0 } = useWindowSize();

  const context = useClientDbContext();

  const summary = context.leaderboard.getPlayerSummary(name || "");

  const reverseGames = useMemo(() => {
    if (!summary) return;
    return summary?.games.slice(Math.max(summary?.games.length - 5, 0)).reverse();
  }, [summary]);

  return (
    <div className="flex flex-col items-center">
      <section className="space-y-1 my-4">
        <div className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4">
          {summary?.isRanked ? (
            <div className="w-16 text-3xl rounded-lg bg-white text-gray-500 flex items-center justify-center">
              #{summary.rank}
            </div>
          ) : (
            <div className="w-16 text-sm rounded-lg bg-white text-gray-500 flex items-center justify-center">
              <p className="text-center">Not yet ranked</p>
            </div>
          )}
          <section className="grow">
            <h2 className="uppercase text-xl">{name}</h2>
            <section className="flex space-x-4 text-md">
              <div>
                {summary?.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                {/* 🏆 {summary?.wins} 💔 {summary?.loss} */}
                🏆:💔
                {((summary?.wins || 0) / (summary?.loss || 0)).toLocaleString("no-NO", {
                  maximumFractionDigits: 1,
                })}
              </div>
            </section>
          </section>
        </div>
      </section>

      {summary && (
        <LineChart
          width={Math.min(730, width)}
          height={250}
          data={summary?.games}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 4" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
          />
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
      {/* <h1 className="text-2xl text-center mt-4">
        Total {summary && summary?.games.length + " games"}
      </h1> */}
      <h1 className="text-2xl text-center mt-4">Last 5 games</h1>
      <div className="w-fit">
        <table className="w-full">
          <thead>
            <tr>
              <th>Game</th>
              <th>Elo +-</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {reverseGames?.map((game, index) => {
              return (
                <tr key={index}>
                  <td className="text-left px-4">
                    <Link to={`/player/${game.oponent}`} className="h-full hover:bg-gray-500/50 flex w-full">
                      {game.result === "win" ? "🏆 " : "💔 "} {game.oponent}
                    </Link>
                  </td>
                  <td className="text-right pr-4">
                    {game.pointsDiff.toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="text-right">{timeAgo(new Date(game.time))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const game = payload[0].payload;
    return (
      <div className="p-2 bg-slate-700 ring-1 ring-white rounded-lg">
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
