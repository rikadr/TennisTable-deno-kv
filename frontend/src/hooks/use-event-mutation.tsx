import { useMutation } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { EventType } from "../client/client-db/event-store/event-types";

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
  });
}

export function useDeleteEventMutation() {
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
  });
}
