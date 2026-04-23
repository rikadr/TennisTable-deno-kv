import { useMutation, useQuery } from "@tanstack/react-query";
import { httpClient } from "../../common/http-client";
import { LiveGameState } from "./live-game-types";
import { queryClient } from "../../common/query-client";

const LIVE_GAME_QUERY_KEY = ["live-game"];

export function useLiveGameQuery(options?: { refetchIntervalMs?: number }) {
  return useQuery<LiveGameState | null>({
    queryKey: LIVE_GAME_QUERY_KEY,
    queryFn: async () => {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/live-game`);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      const text = await res.text();
      if (!text) return null;
      return JSON.parse(text) as LiveGameState;
    },
    refetchInterval: options?.refetchIntervalMs ?? 2_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useUpdateLiveGameMutation() {
  return useMutation({
    mutationFn: async (state: LiveGameState) => {
      const res = await httpClient(`${process.env.REACT_APP_API_BASE_URL}/live-game`, {
        method: "PUT",
        body: JSON.stringify(state),
      });
      return (await res.json()) as LiveGameState;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(LIVE_GAME_QUERY_KEY, data);
    },
  });
}

export function useClearLiveGameMutation() {
  return useMutation({
    mutationFn: async () => {
      await httpClient(`${process.env.REACT_APP_API_BASE_URL}/live-game`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.setQueryData(LIVE_GAME_QUERY_KEY, null);
    },
  });
}
