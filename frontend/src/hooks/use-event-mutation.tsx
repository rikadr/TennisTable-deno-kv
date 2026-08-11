import { useMutation } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";
import { EventType } from "../client/client-db/event-store/event-types";
import { useToast } from "../wrappers/toast-provider";

function saveErrorMessage(action: string, error: Error): string {
  // httpClient throws "HTTP error <status>: ..." when the server rejected the
  // request; anything else (a fetch TypeError) is a connectivity problem.
  if (error.message.startsWith("HTTP error")) {
    return `Could not ${action} — the server rejected the request. (${error.message})`;
  }
  const base = `Could not ${action} — check your connection and try again.`;
  return error.message ? `${base} (${error.message})` : base;
}

// suppressErrorToast is for callers that render the failure themselves (e.g.
// an inline form error), so the user does not get two messages for one error.
type EventMutationOptions = { suppressErrorToast?: boolean };

export function useEventMutation(options?: EventMutationOptions) {
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
    onError: (error) => {
      if (options?.suppressErrorToast) return;
      showToast("error", saveErrorMessage("save", error));
    },
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
