import React from "react";
import { CreateMockData, MockPlayer } from "./mock-data-class";
import { httpClient } from "../../../common/http-client";
import { useMutation } from "@tanstack/react-query";

export const GenerateMockData: React.FC = () => {
  const syncMutation = useMutation({
    mutationFn: async () => {
      const events = generate();
      const postRes = await httpClient(`${process.env.REACT_APP_API_BASE_URL}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(events),
      });
      if (!postRes.ok) throw new Error(`Post failed: ${postRes.statusText}`);
    },
  });

  const loading = syncMutation.isPending;

  return (
    <div className="bg-secondary-background text-secondary-text rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Generate mock data</h2>
      <button
        onClick={() => window.confirm("Generate mock data events?") && syncMutation.mutate()}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        Generate mock data events. See code for configuration
      </button>
    </div>
  );
};

function generate() {
  const mockPlayers: MockPlayer[] = [];
  let playerIndex = 0;

  for (let skill = 0.1; skill <= 0.5 && playerIndex < 100; skill = Math.round((skill + 0.1) * 10) / 10) {
    for (let prob = 0.1; prob <= 0.4 && playerIndex < 100; prob = Math.round((prob + 0.1) * 10) / 10) {
      mockPlayers.push({
        name: `Player-S${skill}-P${prob}`,
        skillLevel: skill,
        gameProbability: prob,
      });
      playerIndex++;
    }
  }

  const events = new CreateMockData(mockPlayers, 500).generate();
  return events;
}
