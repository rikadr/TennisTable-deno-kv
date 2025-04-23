import { useEffect, useMemo, useState } from "react";
import { classNames } from "../common/class-names";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { useWindowSize } from "usehooks-ts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useEventDbContext } from "../wrappers/event-db-context";
import { fmtNum } from "../common/number-utils";
import { stringToColor } from "../common/string-to-color";
import { relativeTimeString } from "../common/date-utils";

export const ComparePlayersPage: React.FC = () => {
  const context = useEventDbContext();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const comparison = useMemo(
    () => context.leaderboard.comparePlayers(selectedPlayers),
    [context.leaderboard, selectedPlayers],
  );
  const [graphDataToSee, setGraphDataToSee] = useState<Record<string, number>[]>(comparison.graphData);
  const [range, setRange] = useState(0);

  const { width = 0, height = 0 } = useWindowSize();

  useEffect(() => {
    setGraphDataToSee(comparison.graphData.slice(Math.max(range - 2, 0)) || []);
  }, [comparison.graphData, range]);

  return (
    <div className="flex flex-col items-center ">
      <section className="flex flex-col-reverse items-center md:items-start md:flex-row md:gap-4 bg-primary-background rounded-lg p-4">
        <PlayerSelector selectedPlayers={selectedPlayers} setSelectedPlayers={setSelectedPlayers} />
        <div className="">
          <input
            className="w-full"
            type="range"
            min="2"
            max={comparison.graphData.length || 0}
            value={range}
            onChange={(e) => setRange(parseInt(e.target.value))}
          />
          {comparison.graphData ? (
            <LineChart
              className="mt-6"
              width={Math.min(1000, width > 1_200 || width < 768 ? width - 50 : width - 230)}
              height={Math.min(500, Math.max(300, height - 100))}
              margin={{ left: -10 }}
              data={graphDataToSee}
            >
              <CartesianGrid strokeDasharray="1 4" vertical={false} stroke="rgb(var(--color-primary-text))" />
              <XAxis dataKey="name" stroke="rgb(var(--color-primary-text))" />
              <YAxis
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value) => fmtNum(value)!}
                stroke="rgb(var(--color-primary-text))"
              />
              <Tooltip
                formatter={(value) => [value.toLocaleString("no-NO", { maximumFractionDigits: 0 }), "Elo"]}
                wrapperClassName="rounded-lg"
                animationDuration={0}
                content={<CustomTooltip />}
              />
              {graphDataToSee[0] &&
                Object.keys(graphDataToSee[0]).map((player) => (
                  <Line
                    key={player + "color"}
                    type="monotone"
                    dataKey={player}
                    stroke={stringToColor(player)}
                    dot={false}
                    animationDuration={150}
                    strokeWidth={3}
                  />
                ))}
              {graphDataToSee[0] &&
                Object.keys(graphDataToSee[0]).map((key) => {
                  if (key === "time") return null;
                  return (
                    <Line
                      key={key + "main"}
                      type="monotone"
                      dataKey={key}
                      stroke={"white"}
                      dot={false}
                      animationDuration={150}
                      strokeWidth={0.5}
                      opacity={0.5}
                    />
                  );
                })}
              <ReferenceLine
                y={1000}
                label={{ value: "1 000", position: "insideBottom", fill: "rgb(var(--color-primary-text))" }}
                stroke="rgb(var(--color-primary-text))"
              />
            </LineChart>
          ) : (
            <div className="w-[730px] h-[428px] rounded-lg bg-gray-300/50 animate-pulse" />
          )}
        </div>
      </section>
    </div>
  );
};

const PlayerSelector: React.FC<{
  selectedPlayers: string[];
  setSelectedPlayers: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ selectedPlayers, setSelectedPlayers }) => {
  const context = useEventDbContext();

  const playersByRank = context.leaderboard.getLeaderboard().rankedPlayers.map((p) => p.id);
  const allIsSelected = selectedPlayers.length === playersByRank.length;

  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40 h-fit text-white">
      <button
        className={classNames(
          "h-8 text-left pl-4 rounded-lg",
          "bg-gray-500/50",
          allIsSelected ? "bg-green-500/50 ring-2 ring-white hover:bg-green-300/50" : "hover:bg-gray-500",
        )}
        onClick={() => (allIsSelected ? setSelectedPlayers([]) : setSelectedPlayers(playersByRank))}
      >
        {allIsSelected ? "Deselect all" : "Select all"}
      </button>
      {playersByRank.map((playerId, index) => {
        const isSelected = selectedPlayers.includes(playerId);
        return (
          <button
            key={playerId}
            className={classNames(
              "h-8 text-left pl-4 rounded-lg",
              "bg-gray-500/50",
              isSelected ? "opacity-100 ring-2 ring-white" : "hover:opacity-100 opacity-75",
            )}
            style={{ background: stringToColor(playerId) }}
            onClick={() => {
              if (isSelected) {
                setSelectedPlayers((prev) => prev.filter((id) => id !== playerId));
              } else {
                setSelectedPlayers((prev) => [...prev, playerId]);
              }
            }}
          >
            #{index + 1} {context.playerName(playerId)}
          </button>
        );
      })}
    </div>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  const context = useEventDbContext();

  if (active && payload && payload.length) {
    const record = payload[0].payload as Record<string, number>;
    const entries = Object.entries(record);
    entries.sort((a, b) => b[1] - a[1]);

    console.log(payload);

    const gameTime = entries.find((e) => e[0] === "time");

    return (
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg">
        {entries.map(
          (entry) =>
            entry[0] !== "time" && (
              <p key={entry[0]} style={{ color: stringToColor(entry[0]) }}>
                {`${context.playerName(entry[0])}: ${entry[1].toLocaleString("no-NO", { maximumFractionDigits: 0 })}`}
              </p>
            ),
        )}
        {gameTime && gameTime[1] > 0 && <p>{relativeTimeString(new Date(gameTime[1]))}</p>}
      </div>
    );
  }

  return null;
};
