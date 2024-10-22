import { useEffect, useMemo, useState } from "react";
import { classNames } from "../common/class-names";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { useWindowSize } from "usehooks-ts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useClientDbContext } from "../wrappers/client-db-context";

function stringToColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  const brightnessThreshold = 100; // Ensures brightness is above 50%
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xff;
    value = value < brightnessThreshold ? value * 1.11 : value;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
}

export const ComparePlayersPage: React.FC = () => {
  const context = useClientDbContext();
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const comparison = useMemo(
    () => context.leaderboard.comparePlayers(selectedPlayers),
    [context.leaderboard, selectedPlayers],
  );
  const [graphDataToSee, setGraphDataToSee] = useState<Record<string, number>[]>(comparison.graphData);
  const [range, setRange] = useState(0);

  const { width = 0 } = useWindowSize();

  useEffect(() => {
    setGraphDataToSee(comparison.graphData.slice(Math.max(range - 2, 0)) || []);
  }, [comparison.graphData, range]);

  return (
    <div className="flex flex-col items-center gap-4">
      <section className="flex flex-col items-center md:flex-row">
        <PlayerSelector
          players={comparison.allPlayers}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
        />
        <div className="ml-6">
          <input
            className="w-full"
            type="range"
            min="2"
            max={comparison.graphData.length || 0}
            value={range}
            onChange={(e) => setRange(parseInt(e.target.value))}
          />
          {comparison.graphData ? (
            <LineChart className="mt-7" width={Math.min(730, width)} height={400} data={graphDataToSee}>
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
              {graphDataToSee[0] &&
                Object.keys(graphDataToSee[0]).map((player) => (
                  <Line
                    key={player}
                    type="monotone"
                    dataKey={player}
                    stroke={stringToColor(player)}
                    animationDuration={150}
                    dot={false}
                  />
                ))}
              <ReferenceLine y={1000} stroke="white" label="1 000" />
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
  players: string[];
  selectedPlayers: string[];
  setSelectedPlayers: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ players, selectedPlayers, setSelectedPlayers }) => {
  const sortedPlayers = useMemo(() => players.sort(), [players]);
  const allIsSelected = selectedPlayers.length === sortedPlayers.length;

  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40 h-fit">
      Comparing players
      <button
        className={classNames(
          "h-8 text-left pl-4 rounded-lg",
          "bg-gray-500/50",
          allIsSelected ? "bg-green-500/50 ring-2 ring-white hover:bg-green-300/50" : "hover:bg-gray-500",
        )}
        onClick={() => (allIsSelected ? setSelectedPlayers([]) : setSelectedPlayers(sortedPlayers))}
      >
        {allIsSelected ? "Deselect all" : "Select all"}
      </button>
      {sortedPlayers.map((player) => {
        const isSelected = selectedPlayers.includes(player);
        return (
          <button
            key={player}
            className={classNames(
              "h-8 text-left pl-4 rounded-lg",
              "bg-gray-500/50",
              isSelected ? "opacity-100 ring-2 ring-white" : "hover:opacity-100 opacity-75",
            )}
            style={{ background: stringToColor(player) }}
            onClick={() => {
              if (isSelected) {
                setSelectedPlayers((prev) => prev.filter((name) => name !== player));
              } else {
                setSelectedPlayers((prev) => [...prev, player]);
              }
            }}
          >
            {player}
          </button>
        );
      })}
    </div>
  );
};

const CustomTooltip: React.FC = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const record = payload[0].payload as Record<string, number>;
    const entries = Object.entries(record);
    entries.sort((a, b) => b[1] - a[1]);

    return (
      <div className="p-2 bg-slate-700 ring-1 ring-white rounded-lg">
        {entries.map((entry) => (
          <p key={entry[0]} style={{ color: stringToColor(entry[0]) }}>
            {`${entry[0]}: ${entry[1].toLocaleString("no-NO", { maximumFractionDigits: 0 })}`}
          </p>
        ))}
      </div>
    );
  }

  return null;
};
