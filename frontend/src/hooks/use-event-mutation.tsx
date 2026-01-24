import { useMutation, useQueryClient } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { EventType } from "../client/client-db/event-store/event-types";

const LOCAL_STORAGE_KEY = "tennis-table-events";
const CACHE_TIMESTAMP_KEY = "tennis-table-events-cache-time";

function clearEventsCache() {
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem(CACHE_TIMESTAMP_KEY);
}

export function useEventMutation() {
  return useMutation({
    mutationFn: async (payloadEvent: EventType) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payloadEvent),
      });
    },
  });
}

export function useUpdateEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ oldEventTime, updatedEvent }: { oldEventTime: number; updatedEvent: EventType }) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/event`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oldEventTime, updatedEvent }),
      });
    },
    onSuccess: () => {
      clearEventsCache();
      queryClient.invalidateQueries({ queryKey: ["event-db"] });
    },
  });
}

export function useDeleteEventMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventTime: number) => {
      return httpClient(`${process.env.REACT_APP_API_BASE_URL}/event`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventTime }),
      });
    },
    onSuccess: () => {
      clearEventsCache();
      queryClient.invalidateQueries({ queryKey: ["event-db"] });
    },
  });
}
