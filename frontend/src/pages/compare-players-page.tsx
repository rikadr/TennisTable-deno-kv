import { useEffect, useMemo, useState } from "react";
import { classNames } from "../common/class-names";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, TooltipProps, XAxis, YAxis } from "recharts";
import { useWindowSize } from "usehooks-ts";
import { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import { useClientDbContext } from "../wrappers/client-db-context";
import { Switch } from "@headlessui/react";
import { fmtNum } from "../common/number-utils";

export function stringToColor(name?: string) {
  if (!name) return "#4338ca";
  switch (name) {
    case "Peder":
    case "Rikard":
    case "Simone":
      name = name.toLowerCase();
  }
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

  const { width = 0, height = 0 } = useWindowSize();

  useEffect(() => {
    setGraphDataToSee(comparison.graphData.slice(Math.max(range - 2, 0)) || []);
  }, [comparison.graphData, range]);

  return (
    <div className="flex flex-col items-center">
      <section className="flex flex-col-reverse items-center md:items-start md:flex-row md:gap-4">
        <PlayerSelector
          players={comparison.allPlayers}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
        />
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
              <CartesianGrid strokeDasharray="1 4" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis type="number" domain={["dataMin", "dataMax"]} tickFormatter={(value) => fmtNum(value)} />
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
                Object.keys(graphDataToSee[0]).map((player) => (
                  <Line
                    key={player + "main"}
                    type="monotone"
                    dataKey={player}
                    stroke={"white"}
                    dot={false}
                    animationDuration={150}
                    strokeWidth={0.5}
                    opacity={0.5}
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
  const context = useClientDbContext();

  const playersByName = useMemo(() => players.sort(), [players]);
  const playersByRank = context.leaderboard.getLeaderboard().rankedPlayers.map((p) => p.name);
  const [byRank, setByRank] = useState(false);
  const allIsSelected = selectedPlayers.length === (byRank ? playersByRank.length : playersByName.length);

  useEffect(() => {
    if (byRank) {
      setSelectedPlayers(selectedPlayers.filter((p) => playersByRank.includes(p)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byRank]);

  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40 h-fit">
      Comparing players by
      <Switch
        checked={byRank}
        onChange={setByRank}
        className="group relative flex h-10 w-[10rem] cursor-pointer rounded-full bg-secondary-background p-1 transition-colors duration-200 ease-in-out focus:outline-none data-[focus]:outline-1 data-[focus]:outline-white"
      >
        <div className="absolute top-1/2 transform -translate-y-1/2 left-[1rem] z-10">Name {!byRank && "🔡"}</div>
        <div className="absolute top-1/2 transform -translate-y-1/2 right-[1rem] z-10">{byRank && "🥇 "} Rank </div>
        <span
          aria-hidden="true"
          className="pointer-events-none inline-block h-8 w-[5.8rem] group-data-[checked]:w-[5.1rem] translate-x-0 rounded-full bg-primary-background ring-0 shadow-lg transition duration-200 ease-in-out group-data-[checked]:translate-x-[4.4rem]"
        />
      </Switch>
      <button
        className={classNames(
          "h-8 text-left pl-4 rounded-lg",
          "bg-gray-500/50",
          allIsSelected ? "bg-green-500/50 ring-2 ring-white hover:bg-green-300/50" : "hover:bg-gray-500",
        )}
        onClick={() =>
          allIsSelected ? setSelectedPlayers([]) : setSelectedPlayers(byRank ? playersByRank : playersByName)
        }
      >
        {allIsSelected ? "Deselect all" : "Select all"}
      </button>
      {(byRank ? playersByRank : playersByName).map((player, index) => {
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
            {byRank && `#${index + 1}`} {player}
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
      <div className="p-2 bg-primary-background ring-1 ring-primary-text rounded-lg">
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
