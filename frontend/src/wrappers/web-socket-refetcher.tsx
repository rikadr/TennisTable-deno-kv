import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_MESSAGE } from "../hooks/use-web-socket";
import { useEffect, useState, useRef } from "react";
import { useEventDbContext } from "./event-db-context";

type Props = {
  children: React.ReactNode;
};
declare global {
  interface Window {
    socket: { ws: WebSocket | undefined; connectionId: string | undefined };
  }
}

const HEART_BEAT_INTERVAL_MS = 45 * 1_000; // 45 seconds
const HEART_BEAT_TIMEOUT_MS = 120 * 1_000; // 2 minutes

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string>();
  const lastHeartBeatReplyRef = useRef(Date.now());
  const context = useEventDbContext();

  // Use a ref to always have the latest events
  const eventsRef = useRef(context.events);
  useEffect(() => {
    eventsRef.current = context.events;
  }, [context.events]);

  function onMessage(message: string) {
    lastHeartBeatReplyRef.current = Date.now();

    if (message.startsWith(WS_MESSAGE.CONNECTION_ID)) {
      setConnectionId(message.split(":")[1]);
      return;
    }
    if (message.startsWith(WS_MESSAGE.HEART_BEAT)) {
      return;
    }
    if (message.startsWith(WS_MESSAGE.LATEST_EVENT)) {
      const latestDbEvent = parseInt(message.split(":")[1]);
      // Use the ref instead of context directly
      const currentEvents = eventsRef.current;
      const latestLocalEvent = currentEvents[currentEvents.length - 1]?.time;
      if (latestDbEvent && latestLocalEvent !== latestDbEvent) {
        queryClient.invalidateQueries();
      }
      return;
    }
  }

  const { webSocket } = useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates", {
    onMessage,
    onClose() {
      setConnectionId(undefined);
    },
  });

  // Heart beat
  useEffect(() => {
    if (!webSocket || !connectionId) return;

    const interval = setInterval(() => {
      if (Date.now() - lastHeartBeatReplyRef.current > HEART_BEAT_TIMEOUT_MS) {
        webSocket.close();
      } else {
        webSocket.send(WS_MESSAGE.HEART_BEAT + ":" + connectionId);
        webSocket.send(WS_MESSAGE.LATEST_EVENT);
      }
    }, HEART_BEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [webSocket, connectionId]);

  // Update window.socket
  useEffect(() => {
    window.socket = { ws: webSocket, connectionId };
  }, [webSocket, connectionId]);

  return children;
};
