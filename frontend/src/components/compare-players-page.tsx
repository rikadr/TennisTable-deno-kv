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

type PlayerComparison = {
  allPlayers: string[];
  graphData: Record<string, number>[];
};

function usePlayerSummaryQuery(players?: string[]) {
  return useQuery<PlayerComparison>({
    queryKey: ["player-summary", players?.sort()],
    queryFn: async () => {
      const url = new URL(
        `${process.env.REACT_APP_API_BASE_URL}/compare-players`
      );
      url.searchParams.append("players", JSON.stringify(players));
      return fetch(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<PlayerComparison>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export const ComparePlayersPage: React.FC = () => {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const comparison = usePlayerSummaryQuery(selectedPlayers);
  const { width = 0 } = useWindowSize();

  return (
    <div className="flex flex-col items-center">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <section className="flex flex-col lg:flex-row">
        <PlayerSelector
          players={comparison.data?.allPlayers}
          isLoading={comparison.isLoading}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
        />
        {comparison.data?.graphData && (
          <LineChart
            className="mt-7"
            width={Math.min(730, width)}
            height={400}
            data={comparison.data.graphData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="1 4" vertical={false} />
            <XAxis
              dataKey="name"
              // ?
            />
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
            {comparison.data.graphData[0] &&
              Object.keys(comparison.data.graphData[0]).map((player) => (
                <Line
                  key={player}
                  type="monotone"
                  dataKey={player}
                  stroke="#8884d8"
                  animationDuration={100}
                  dot={false}
                />
              ))}
            <ReferenceLine y={1000} stroke="white" label="1 000" />
          </LineChart>
        )}
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
      setStoredPlayers(players);
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
            ? "bg-green-500/50 ring-2 ring-white hver:bg-green-300"
            : "hover:bg-gray-500"
        )}
        onClick={() =>
          allIsSelected
            ? setSelectedPlayers([])
            : setSelectedPlayers(storedPlayers)
        }
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
                ? "bg-green-500/50 ring-2 ring-white hover:bg-green-300/50"
                : "hover:bg-gray-500"
            )}
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
          <p key={entry[0]}>{`${entry[0]}: ${entry[1].toLocaleString("no-NO", {
            maximumFractionDigits: 0,
          })}`}</p>
        ))}
      </div>
    );
  }

  return null;
};
