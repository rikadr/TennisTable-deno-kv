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
  const mockPlayers: MockPlayer[] = [
    { name: "Alexander", skillLevel: 1.52, gameProbability: 0.3 },
    { name: "Fooa", skillLevel: 1.35, gameProbability: 0.5 },
    { name: "Rasmus", skillLevel: 1.34, gameProbability: 0.55 },
    { name: "Christoffer", skillLevel: 1.29, gameProbability: 0.12 },
    { name: "Oskar", skillLevel: 1.27, gameProbability: 0.55 },
    { name: "Erling", skillLevel: 1.13, gameProbability: 0.4 },
    { name: "Marius", skillLevel: 1.11, gameProbability: 0.2 },
    { name: "Simone", skillLevel: 1.11, gameProbability: 0.75 },
    { name: "Peder", skillLevel: 1.03, gameProbability: 0.6 },
    { name: "Anders", skillLevel: 1.03, gameProbability: 0.18 },
    { name: "Gustas", skillLevel: 0.98, gameProbability: 0.09 },
    { name: "Rikard", skillLevel: 0.91, gameProbability: 0.9 },
    { name: "Ole", skillLevel: 0.89, gameProbability: 0.55 },
    { name: "Fredrik", skillLevel: 0.88, gameProbability: 0.3 },
    { name: "Axel", skillLevel: 0.78, gameProbability: 0.16 },
    { name: "Bendik", skillLevel: 0.71, gameProbability: 0.5 },
    { name: "Sveinung", skillLevel: 0.68, gameProbability: 0.11 },
    { name: "Francesco", skillLevel: 0.48, gameProbability: 0.15 },
    { name: "Daniel", skillLevel: 0.45, gameProbability: 0.5 },
  ];
  const events = new CreateMockData(mockPlayers, 365).generate();
  return events;
}
