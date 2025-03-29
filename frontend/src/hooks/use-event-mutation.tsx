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
