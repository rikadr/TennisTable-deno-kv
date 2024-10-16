import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "../common/query-client";
import { Link, useNavigate } from "react-router-dom";
import { httpClient } from "../common/http-client";

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");

  const addPlayerMutation = useMutation<unknown, Error, { name: string }, unknown>({
    mutationFn: async ({ name }) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/player`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      navigate("/");
    },
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <Link
        to="/leader-board"
        className="whitespace-nowrap text-sm font-thin ring-1 ring-white px-2 py-1 mt-1 rounded-lg hover:bg-gray-500/50"
      >
        Back to leaderboard
      </Link>
      <h1>Add player</h1>
      <p>Player name</p>
      <input
        type="text"
        className="text-black"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="Name"
      />
      <button
        className="text-sm bg-green-700 hover:bg-green-900 text-white px-1 rounded-md font-thin"
        onClick={() => addPlayerMutation.mutate({ name: playerName })}
      >
        Add player
      </button>
    </div>
  );
};
