import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_MESSAGE } from "../hooks/use-web-socket";
import { useEffect, useState } from "react";
import { useHeartbeat } from "../hooks/use-heartbeat";

type Props = {
  children: React.ReactNode;
};
declare global {
  interface Window {
    socket: { ws: WebSocket | undefined; connectionId: string | undefined };
  }
}

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string>();

  function onMessage(message: string) {
    if (message.startsWith(WS_MESSAGE.CONNECTION_ID)) {
      setConnectionId(message.split(":")[1]);
      return;
    }
    if (message === WS_MESSAGE.RELOAD) {
      queryClient.invalidateQueries();
      return;
    }
  }

  const { webSocket } = useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates", {
    onMessage,
    onClose() {
      setConnectionId(undefined);
    },
  });

  useHeartbeat(() => connectionId, webSocket);

  window.socket = { ws: webSocket, connectionId };

  // Refresh the page every 30 minutes
  useEffect(() => {
    const refreshInterval = 30 * 60 * 1000; // 30 minutes in milliseconds

    const intervalId = setInterval(() => {
      window.location.reload();
    }, refreshInterval);

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return children;
};
