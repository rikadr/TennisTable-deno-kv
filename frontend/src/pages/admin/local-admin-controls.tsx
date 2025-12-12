import { useMutation } from "@tanstack/react-query";
import React, { useState } from "react";
import { httpClient } from "../../common/http-client";
import { GenerateMockData } from "./mock-data/generate-mock-data";

import { convertDeepInsightData } from "../../utils/convert-deepinsight-data";
import { DEEPINSIGHT_DATA } from "../../data/deepinsight-data";

const LOCAL_API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
const LOCAL_STORAGE_KEY = "tennis-table-events";

const PRODUCTION_ENVIRONMENTS = [
  { name: "Optio", url: "https://tennis-table-optio.deno.dev" },
  { name: "Tryvann", url: "https://tennis-table-tryvann.deno.dev" },
  { name: "Asplan Viak", url: "https://tennis-table-asplan-viak.deno.dev" },
  { name: "Deepinsight", url: "https://tennis-table-deepinsight.deno.dev" },
];

export const LocalAdminControls: React.FC = () => {
  const [selectedEnv, setSelectedEnv] = useState(PRODUCTION_ENVIRONMENTS[0]);

  const deleteMutation = useMutation({
    mutationFn: () =>
      httpClient(`${LOCAL_API_BASE}/events`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }).then((res) => {
        if (!res.ok) throw new Error(`Delete failed: ${res.statusText}`);
        // Clear localStorage cache
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      await deleteMutation.mutateAsync();

      const res = await httpClient(`${selectedEnv.url}/events`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);

      const events = await res.json();

      const postRes = await httpClient(`${LOCAL_API_BASE}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(events),
      });
      if (!postRes.ok) throw new Error(`Post failed: ${postRes.statusText}`);

      // Clear localStorage cache so it refetches
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      return { count: events.length, env: selectedEnv.name };
    },
  });

  const importDeepInsightMutation = useMutation({
    mutationFn: async () => {
        const events = convertDeepInsightData(DEEPINSIGHT_DATA);
        
        // Post events
        const postRes = await httpClient(`${LOCAL_API_BASE}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(events),
        });
        if (!postRes.ok) throw new Error(`Post failed: ${postRes.statusText}`);

        localStorage.removeItem(LOCAL_STORAGE_KEY);
        return { count: events.length };
    }
  });

  const loading = syncMutation.isPending || deleteMutation.isPending || importDeepInsightMutation.isPending;
  const error = syncMutation.error || deleteMutation.error || importDeepInsightMutation.error;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="bg-secondary-background text-secondary-text rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6">Local Admin Controls</h2>

        <select
          value={selectedEnv.name}
          onChange={(e) => setSelectedEnv(PRODUCTION_ENVIRONMENTS.find((env) => env.name === e.target.value)!)}
          disabled={loading}
          className="w-full mb-4 px-4 py-2 text-black border rounded-lg disabled:bg-gray-100"
        >
          {PRODUCTION_ENVIRONMENTS.map((env) => (
            <option key={env.name} value={env.name}>
              {env.name}
            </option>
          ))}
        </select>

        <div className="space-y-3">
          <button
            onClick={() => window.confirm(`Replace local with ${selectedEnv.name}?`) && syncMutation.mutate()}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {syncMutation.isPending ? "Syncing..." : `Sync from ${selectedEnv.name}`}
          </button>

          <button
            onClick={() => window.confirm("Delete all local events?") && deleteMutation.mutate()}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400"
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete Local Events"}
          </button>
        </div>

        {(syncMutation.isSuccess || deleteMutation.isSuccess || importDeepInsightMutation.isSuccess || error) && (
          <div className={`mt-4 p-3 rounded-lg ${error ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
            {error
              ? `❌ ${error instanceof Error ? error.message : "Operation failed"}`
              : syncMutation.isSuccess
              ? `✅ Synced ${syncMutation.data?.count || 0} events from ${syncMutation.data?.env}`
              : deleteMutation.isSuccess 
              ? "✅ Local events deleted"
              : `✅ Imported ${importDeepInsightMutation.data?.count} DeepInsight events`}
          </div>
        )}

        <div className="mt-8 border-t pt-6">
            <h3 className="font-bold mb-4">DeepInsight Migration</h3>
            <div className="space-y-3">
                <button
                    onClick={() => {
                        const events = convertDeepInsightData(DEEPINSIGHT_DATA);
                        console.log("Converted Events:", events);
                        alert(`Logged ${events.length} events to console.`);
                    }}
                    disabled={loading}
                    className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 disabled:bg-gray-400"
                >
                    Log DeepInsight Data Result
                </button>
                 <button
                    onClick={() => {
                        if (window.confirm("This will ADD the DeepInsight events to the current DB. Proceed?")) {
                            importDeepInsightMutation.mutate();
                        }
                    }}
                    disabled={loading}
                    className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                    {importDeepInsightMutation.isPending ? "Importing..." : "Post Result to /events"}
                </button>
            </div>
        </div>
      </div>

      <GenerateMockData />
    </div>
  );
};
