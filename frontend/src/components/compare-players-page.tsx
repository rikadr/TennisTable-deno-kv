import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { classNames } from "../common/class-names";
import { useQuery } from "@tanstack/react-query";

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
  return (
    <div className="flex flex-col items-center">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <section className="space-y-1 my-4">
        Comparing players
        <PlayerSelector
          players={comparison.data?.allPlayers}
          isLoading={comparison.isLoading}
          selectedPlayers={selectedPlayers}
          setSelectedPlayers={setSelectedPlayers}
        />
        {comparison.data?.graphData?.map((entry) => (
          <pre>{JSON.stringify(entry)}</pre>
        ))}
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
    <div className="grid grid-cols-1 gap-1 grid-flow-row w-40">
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
