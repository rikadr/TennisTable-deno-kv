import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useEventDbContext } from "../../wrappers/event-db-context";

import { stringToColor } from "../../common/string-to-color";
import { Elo } from "../../client/client-db/elo";
import { relativeTimeString } from "../../common/date-utils";

export const PlayerEloGraph: React.FC<{ playerId: string; showExpectedElo: boolean }> = ({
  playerId,
  showExpectedElo,
}) => {
  const { width = 0 } = useWindowSize();

  const context = useEventDbContext();
  const summary = context.leaderboard.getPlayerSummary(playerId || "");

  const graphGames = useMemo(() => {
    const games = [...summary.games];
    games.unshift({ eloAfterGame: Elo.INITIAL_ELO, oponent: summary.id, pointsDiff: 0, result: "win", time: 0 });
    if (showExpectedElo) {
      const simulatedElos = context.simulations.expectedPlayerEloOverTime(playerId);
      return games.map((game, index) => {
        const simulatedElo = simulatedElos.find((e) => e.time === game.time);
        if (
          !simulatedElo ||
          simulatedElo.elo === Elo.INITIAL_ELO ||
          simulatedElo.time !== game.time ||
          index < context.client.gameLimitForRanked - 1
        ) {
          if (game.time === 1732874368730) {
          }
          return game;
        }
        return { ...game, simulatedElo: simulatedElos[index - 1]?.elo };
      });
    }
    return games;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, showExpectedElo, playerId]);

  if (summary.games.length === 0) {
    return null;
  }

  return (
    <LineChart
      width={Math.min(1000, width < 768 ? width : width - 300)}
      height={300}
      data={graphGames}
      margin={{ top: 5, right: 25, left: 0 }}
    >
      <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" opacity={1} />
      <YAxis
        type="number"
        domain={["dataMin", "dataMax"]}
        tickFormatter={(value) => value.toLocaleString("no-NO", { maximumFractionDigits: 0 })}
        stroke="rgb(var(--color-primary-text))"
      />
      <XAxis dataKey="name" stroke="rgb(var(--color-primary-text))" />
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
            stroke={type === "main" ? "white" : stringToColor(playerId)}
            dot={false}
            animationDuration={100}
            strokeWidth={type === "main" ? 0.5 : 5}
          />
        );
      })}

      <Line
        type="monotone"
        dataKey="simulatedElo"
        stroke="white"
        dot={false}
        animationDuration={100}
        strokeWidth={0.5}
      />

      <ReferenceLine
        y={1000}
        stroke="rgb(var(--color-primary-text))"
        label={{ value: "1 000", position: "insideBottom", fill: "rgb(var(--color-primary-text))" }}
        color="#"
      />
      {context.futureElo.predictedGames[0] && (
        <ReferenceLine
          x={context.games.filter((g) => g.winner === playerId || g.loser === playerId).length}
          stroke="rgb(var(--color-primary-text))"
          opacity={0.5}
          label={{
            value: "Now",
            position: "insideBottomLeft",
            fill: "rgb(var(--color-primary-text))",
            opacity: 0.5,
          }}
          color="#"
        />
      )}
    </LineChart>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  const constext = useEventDbContext();
  if (active && payload && payload.length) {
    const game = payload[0].payload;
    return (
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg text-primary-text">
        <p>
          {`Elo : ${payload[0].value?.toLocaleString("no-NO", { maximumFractionDigits: 0 })}`}{" "}
          {game.simulatedElo && `(${game.simulatedElo?.toLocaleString("no-NO", { maximumFractionDigits: 0 })})`}
        </p>
        <p className="desc">
          {game?.result === "win"
            ? `🏆 +${game.pointsDiff?.toLocaleString("no-NO", { maximumFractionDigits: 0 })} from`
            : `💔 ${game.pointsDiff?.toLocaleString("no-NO", { maximumFractionDigits: 0 })} to`}{" "}
          {constext.playerName(game.oponent)}
        </p>
        {game.time > 0 && <p>{relativeTimeString(new Date(game.time))}</p>}
      </div>
    );
  }

  return null;
};
