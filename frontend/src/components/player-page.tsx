import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { timeAgo } from "../common/date-utils";
import { PlayerSummaryDTO } from "./leader-board-page";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  TooltipProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useQuery } from "@tanstack/react-query";

function usePlayerSummaryQuery(name?: string) {
  return useQuery<PlayerSummaryDTO>({
    queryKey: ["player-summary", name],
    queryFn: async () => {
      return fetch(
        `${process.env.REACT_APP_API_BASE_URL}/player-summary/${name}`,
        {
          method: "GET",
        }
      ).then(async (response) => response.json() as Promise<PlayerSummaryDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    enabled: !!name,
  });
}

export const PlayerPage: React.FC = () => {
  const { name } = useParams();
  const { width = 0 } = useWindowSize();

  const playerSummaryQuery = usePlayerSummaryQuery(name);

  const reverseGames = useMemo(() => {
    if (!playerSummaryQuery.data) return;
    return playerSummaryQuery.data.games.slice().reverse();
  }, [playerSummaryQuery.data]);

  return (
    <div className="flex flex-col items-center">
      <Link
        to="/"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <section className="space-y-1 my-4">
        <div className="bg-gray-500/50 w-96 h-20 p-2 rounded-lg flex space-x-4">
          {playerSummaryQuery.data?.isRanked ? (
            <div className="w-16 text-3xl rounded-lg bg-white text-gray-500 flex items-center justify-center">
              #{playerSummaryQuery.data.rank}
            </div>
          ) : (
            <div className="w-16 text-sm rounded-lg bg-white text-gray-500 flex items-center justify-center">
              <p className="text-center"> Not yet ranked</p>
            </div>
          )}
          <section className="grow">
            <h2 className="uppercase text-xl">{name} </h2>
            <section className="flex space-x-4 text-md">
              <div>
                {playerSummaryQuery.data?.elo.toLocaleString("no-NO", {
                  maximumFractionDigits: 0,
                })}
              </div>
              <div>
                🏆 {playerSummaryQuery.data?.wins} 💔{" "}
                {playerSummaryQuery.data?.loss}
              </div>
            </section>
          </section>
        </div>
      </section>
      <h1 className="text-2xl text-center">
        {playerSummaryQuery.data &&
          playerSummaryQuery.data.games.length + " games"}
      </h1>
      {playerSummaryQuery.data && (
        <LineChart
          width={Math.min(730, width)}
          height={250}
          data={playerSummaryQuery.data.games}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="1 4" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) =>
              value.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })
            }
          />
          <Tooltip
            formatter={(value) => [
              value.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              }),
              "Elo",
            ]}
            wrapperClassName="rounded-lg"
            animationDuration={0}
            content={<CustomTooltip />}
          />
          <Line
            type="monotone"
            dataKey="eloAfterGame"
            stroke="#8884d8"
            animationDuration={100}
          />
          <ReferenceLine y={1000} stroke="white" label="1 000" />
        </LineChart>
      )}
      <div className="w-fit">
        {playerSummaryQuery.isLoading ? (
          <div>
            Loading games ...
            <div className="flex items-center justify-center w-full">
              <div className="animate-spin w-min">🏆</div>
              <div className="animate-spin w-min">💔</div>
            </div>
          </div>
        ) : (
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
                      <Link
                        to={`/player/${game.oponent}`}
                        className="h-full hover:bg-gray-500/50 flex w-full"
                      >
                        {game.result === "win" ? "🏆 " : "💔 "} {game.oponent}
                      </Link>
                    </td>
                    <td className="text-right pr-4">
                      {game.pointsDiff.toLocaleString("no-NO", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="text-right">
                      {timeAgo(new Date(game.time))}
                    </td>
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

const CustomTooltip: React.FC = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const game = payload[0].payload;
    return (
      <div className="p-2 bg-slate-700 ring-1 ring-white rounded-lg">
        <p className="">{`Elo : ${payload[0].value?.toLocaleString("no-NO", {
          maximumFractionDigits: 0,
        })}`}</p>
        <p className="desc">
          {game?.result === "win"
            ? `🏆 +${game.pointsDiff?.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })} from`
            : `💔 ${game.pointsDiff?.toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })} to`}{" "}
          {game?.oponent}
        </p>
      </div>
    );
  }

  return null;
};
