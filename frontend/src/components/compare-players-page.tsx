import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { classNames } from "../common/class-names";
import { useQuery } from "@tanstack/react-query";
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
import { useWindowSize } from "usehooks-ts";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { httpClient } from "../common/http-client";

type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

function usePlayerSummaryQuery(players?: string[]) {
  return useQuery<PlayerComparison>({
    queryKey: ["player-summary", players?.sort()],
    queryFn: async () => {
      const url = new URL(
        `${process.env.REACT_APP_API_BASE_URL}/compare-players`,
      );
      url.searchParams.append("players", JSON.stringify(players));
      return httpClient(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayerComparison>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

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
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [playerToSelectFrom, setPlayersToSelectFrom] = useState<string[]>([]);
  const [graphDataToSee, setGraphDataToSee] = useState<
    Record<string, number>[]
  >([]);
  const [range, setRange] = useState(0);
  const comparison = usePlayerSummaryQuery(selectedPlayers);
  const { width = 0 } = useWindowSize();

  useEffect(() => {
    if (comparison.data?.allPlayers) {
      setPlayersToSelectFrom(comparison.data.allPlayers);
    }
  }, [comparison.data?.allPlayers]);

  useEffect(() => {
    setGraphDataToSee(comparison.data?.graphData || []);
    setRange(0);
  }, [comparison.data?.graphData]);

  useEffect(() => {
    setGraphDataToSee(
      comparison.data?.graphData.slice(Math.max(range - 2, 0)) || [],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="flex flex-col items-center gap-4">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <section className="flex flex-col items-center md:flex-row">
        <PlayerSelector
          players={playerToSelectFrom}
          isLoading={playerToSelectFrom.length === 0 && comparison.isLoading}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
        />
        <div className="ml-6">
          <input
            className="w-full"
            type="range"
            min="2"
            max={comparison.data?.graphData.length || 0}
            value={range}
            onChange={(e) => setRange(parseInt(e.target.value))}
          />
          {comparison.data?.graphData
            ? (
              <LineChart
                className="mt-7"
                width={Math.min(730, width)}
                height={400}
                data={graphDataToSee}
              >
                <CartesianGrid strokeDasharray="1 4" vertical={false} />
                <XAxis dataKey="name" // ?
                />
                <YAxis
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(value) =>
                    value.toLocaleString("no-NO", {
                      maximumFractionDigits: 0,
                    })}
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
                {graphDataToSee[0] &&
                  Object.keys(graphDataToSee[0]).map((player) => (
                    <Line
                      key={player}
                      type="monotone"
                      dataKey={player}
                      stroke={stringToColor(player)}
                      animationDuration={100}
                      dot={false}
                    />
                  ))}
                <ReferenceLine y={1000} stroke="white" label="1 000" />
              </LineChart>
            )
            : (
              <div className="w-[730px] h-[428px] rounded-lg bg-gray-300/50 animate-pulse" />
            )}
        </div>
      </section>
    </div>
  );
};

const PlayerSelector: React.FC<{
  players?: string[];
  isLoading: boolean;
  selectedPlayers: string[];
  setSelectedPlayers: React.Dispatch<React.SetStateAction<string[]>>;
}> = ({ players, isLoading, selectedPlayers, setSelectedPlayers }) => {
  const [storedPlayers, setStoredPlayers] = useState<string[]>(players || []);
  useEffect(() => {
    if (players) {
      setStoredPlayers(players.sort());
    }
  }, [players]);
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-1 grid-flow-row w-40">
        {Array.from({ length: 6 }, () => "").map((_, i) => (
          <div className="h-8 animate-pulse rounded-lg bg-gray-500" key={i} />
        ))}
      </div>
    );
  }
  if (!storedPlayers) {
    return <div>Failed to load players</div>;
  }
  const allIsSelected = selectedPlayers.length === storedPlayers.length;

  return (
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40 h-fit">
      Comparing players
      <button
        className={classNames(
          "h-8 text-left pl-4 rounded-lg",
          "bg-gray-500/50",
          allIsSelected
            ? "bg-green-500/50 ring-2 ring-white hover:bg-green-300/50"
            : "hover:bg-gray-500",
        )}
        onClick={() =>
          allIsSelected
            ? setSelectedPlayers([])
            : setSelectedPlayers(storedPlayers)}
      >
        {allIsSelected ? "Deselect all" : "Select all"}
      </button>
      {storedPlayers.map((player) => {
        const isSelected = selectedPlayers.includes(player);
        return (
          <button
            key={player}
            className={classNames(
              "h-8 text-left pl-4 rounded-lg",
              "bg-gray-500/50",
              isSelected
                ? "opacity-100 ring-2 ring-white"
                : "hover:opacity-100 opacity-75",
            )}
            style={{ background: stringToColor(player) }}
            onClick={() => {
              if (isSelected) {
                setSelectedPlayers((prev) =>
                  prev.filter((name) => name !== player)
                );
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

const CustomTooltip: React.FC = ({
  active,
  payload,
  label,
}: TooltipProps<ValueType, NameType>) => {
  if (active && payload && payload.length) {
    const record = payload[0].payload as Record<string, number>;
    const entries = Object.entries(record);
    entries.sort((a, b) => b[1] - a[1]);

    return (
      <div className="p-2 bg-slate-700 ring-1 ring-white rounded-lg">
        {entries.map((entry) => (
          <p key={entry[0]} style={{ color: stringToColor(entry[0]) }}>
            {`${entry[0]}: ${
              entry[1].toLocaleString("no-NO", {
                maximumFractionDigits: 0,
              })
            }`}
          </p>
        ))}
      </div>
    );
  }

  return null;
};
