import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { queryClient } from "../common/query-client";
import { useNavigate } from "react-router-dom";

export const AddPlayerPage: React.FC = () => {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState("");

  const addPlayerMutation = useMutation<
    unknown,
    Error,
    { name: string },
    unknown
  >({
    mutationFn: async ({ name }) => {
      return fetch(`${process.env.REACT_APP_API_BASE_URL}/player`, {
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
