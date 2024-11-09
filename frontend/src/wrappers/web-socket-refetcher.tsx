import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_MESSAGE } from "../hooks/use-web-socket";
import { useState } from "react";
import { useHeartbeat } from "../hooks/use-heartbeat";

type Props = {
  children: React.ReactNode;
};

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

  return children;
};
