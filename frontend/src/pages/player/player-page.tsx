import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { relativeTimeString } from "../../common/date-utils";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useClientDbContext } from "../../wrappers/client-db-context";
import { PodiumPlace } from "../leaderboard/podium-place";
import { PlayerPointsDistrubution } from "./player-points-distribution";
import { ProfilePicture } from "./profile-picture";
import { stringToColor } from "../compare-players-page";
import { PlayerGamesDistrubution } from "./player-games-distribution";

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
      <div className="flex flex-col items-center md:flex-row md:items-start ">
        <div className="w-64">
          <ProfilePicture name={name} clickToEdit border={8} shape="rounded" />
          <div className="w-64 my-4">
            {<PodiumPlace name={name ?? "-"} size="default" place={summary?.rank} playerSummary={summary} />}
          </div>
        </div>

        {summary && (
          <div>
            <LineChart
              width={Math.min(1000, width < 768 ? width : width - 300)}
              height={300}
              data={summary?.games}
              margin={{ top: 5, right: 25, left: 0 }}
            >
              <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="#FFFFFF" opacity={0.3} />
              <YAxis
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
                stroke="#FFFFFF"
              />
              <XAxis dataKey="name" stroke="#FFFFFF" />
              <Tooltip
                formatter={(value) => [value.toLocaleString("no-NO", { maximumFractionDigits: 0 }), "Elo"]}
                wrapperClassName="rounded-lg"
                animationDuration={0}
                content={<CustomTooltip />}
              />
              {["stroke", "main"].map((type) => {
                return (
                  <Line
                    key={type}
                    type="monotone"
                    dataKey="eloAfterGame"
                    stroke={type === "main" ? "white" : stringToColor(name)}
                    dot={false}
                    animationDuration={100}
                    strokeWidth={type === "main" ? 0.5 : 5}
                  />
                );
              })}

              <ReferenceLine
                y={1000}
                stroke="white"
                label={{ value: "1 000", position: "insideBottom", fill: "white" }}
                color="#"
              />
            </LineChart>
            <div className="m-auto w-fit -mt-2">
              <div className="">Longest win-streak 🔥🏆 {summary.streaks?.longestWin}</div>
              <div className="">Longest lose-streak 🔥💔 {summary.streaks?.longestLose}</div>
            </div>
          </div>
        )}
        {!summary && (
          <div className="p-10">
            <h1>It's empty here...</h1>
            <br />
            <p>- Add your Profile picture! 📸</p>
            <p>- Join tournaments! 🏆</p>
            <p>- Play games! 🏓</p>
            <p>- Analyse data and compare players! 📊</p>
          </div>
        )}
      </div>
      {summary && (
        <div className="flex flex-col md:flex-row justify-evenly items-center md:items-start w-full md:mr-4">
          <div className="w-full max-w-2xl flex flex-col justify-center">
            <div className="flex flex-col items-center">
              <h1 className="text-2xl text-center mt-4">Points distribution</h1>
              <div className="w-full max-w-2xl">
                <PlayerPointsDistrubution name={summary?.name} />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <h1 className="text-2xl text-center mt-4">Games distribution</h1>
              <div className="w-full max-w-2xl">
                <PlayerGamesDistrubution name={summary?.name} />
              </div>
            </div>
          </div>

          <div>
            <h1 className="text-2xl text-center mt-4">Last 10 games</h1>
            <div className="flex flex-col divide-y divide-primary-text/50">
              <div className="flex gap-4 text-base text-center mb-2">
                <div className="w-36 ">Game</div>
                <div className="w-12 pl-4 whitespace-nowrap">Elo +-</div>
                <div className="w-24 text-right">Time</div>
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
                  <div className="w-32 text-right text-base">{relativeTimeString(new Date(game.time))}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
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
