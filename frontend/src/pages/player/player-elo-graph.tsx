import React, { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useWindowSize } from "usehooks-ts";
import { useEventDbContext } from "../../wrappers/event-db-context";

import { stringToColor } from "../../common/string-to-color";
import { Elo } from "../../client/client-db/elo";
import { relativeTimeString } from "../../common/date-utils";
import { fmtNum } from "../../common/number-utils";

export const PlayerEloGraph: React.FC<{ playerId: string }> = ({ playerId }) => {
  const { width = 0 } = useWindowSize();

  const context = useEventDbContext();
  const summary = context.leaderboard.getPlayerSummary(playerId || "");

  const [showExpectedElo, setShowExpectedElo] = useState(false);

  const graphGames: ((typeof summary.games)[number] & { simulatedElo?: number })[] = useMemo(() => {
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
          index < context.client.gameLimitForRanked
        ) {
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

  const graphWidth = () => {
    let output = width;

    if (width > 768) {
      output -= 160;
    } else if (width > 450) {
      output -= 120;
    } else if (width > 400) {
      output -= 60;
    } else if (width > 350) {
      output -= 40;
    }
    return Math.min(1140, output);
  };

  const lastGame = graphGames[graphGames.length - 1];
  const nextLastGame = graphGames[graphGames.length - 2];

  return (
    <>
      <LineChart
        width={graphWidth()}
        height={width > 768 ? 350 : 300}
        data={graphGames}
        margin={{ top: 5, right: 0, left: -10 }}
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

      {showExpectedElo && lastGame.simulatedElo && (
        <div className="grid grid-cols-2 sm:grid-cols-3 max-w-[640px] gap-4 text-primary-text mb-2">
          <div className="rounded-lg p-4">
            <p className="text-sm mb-1 whitespace-nowrap">Expected score</p>
            <p className="text-2xl font-bold">{fmtNum(lastGame.simulatedElo)}</p>
          </div>
          <div className="rounded-lg p-4">
            <p className="text-sm mb-1 whitespace-nowrap">Distance from current</p>
            <p className="text-2xl font-bold">
              {fmtNum(lastGame.simulatedElo - lastGame.eloAfterGame, { signedPositive: true })}{" "}
              {lastGame.simulatedElo - lastGame.eloAfterGame > 0 ? "↗" : "↘"}
            </p>
          </div>
          {summary.games.length >= context.client.gameLimitForRanked + 1 && nextLastGame?.simulatedElo && (
            <div className="rounded-lg p-4">
              <p className="text-sm mb-1 whitespace-nowrap">Last game</p>
              <p className="text-2xl font-bold">
                {fmtNum(lastGame.simulatedElo - nextLastGame.simulatedElo, { digits: 0, signedPositive: true })}{" "}
                {lastGame.simulatedElo - nextLastGame.simulatedElo > 0 ? "↗" : "↘"}
              </p>
            </div>
          )}
        </div>
      )}
      {showExpectedElo && (
        <>
          <p className="text-xs">* Simulation has some randomness every time.</p>
          <p className="text-xs">Might fluctuate wildly when too little data (few games)</p>
          <p className="text-xs">or when the total points pool increases by more players becomeing ranked</p>
        </>
      )}
      {summary.games.length >= context.client.gameLimitForRanked && (
        <button
          className="mt-4 px-2 py-1 bg-secondary-background text-secondary-text ring-1 ring-secondary-text hover:bg-secondary-background/50 rounded-lg"
          onClick={() => setShowExpectedElo((prev) => !prev)}
        >
          {showExpectedElo ? "Hide" : "Simulate"} expected score
        </button>
      )}
    </>
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
