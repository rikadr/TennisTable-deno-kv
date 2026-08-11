import { useMutation } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { EventType } from "../client/client-db/event-store/event-types";
import { useToast } from "../wrappers/toast-provider";

function saveErrorMessage(action: string, error: Error): string {
  const base = `Could not ${action} — check your connection and try again.`;
  return error.message ? `${base} (${error.message})` : base;
}

export function useEventMutation() {
  const { showToast } = useToast();
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
    onError: (error) => showToast("error", saveErrorMessage("save", error)),
  });
}

export function useUpdateEventMutation() {
  const { showToast } = useToast();
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
    onError: (error) => showToast("error", saveErrorMessage("save", error)),
  });
}

export function useDeleteEventMutation() {
  const { showToast } = useToast();
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
    onError: (error) => showToast("error", saveErrorMessage("delete", error)),
  });
}
