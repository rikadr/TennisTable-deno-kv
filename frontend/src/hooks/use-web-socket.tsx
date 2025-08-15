import { useEffect, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_MESSAGE {
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
  LATEST_EVENT = "latest-event",
}

export const useWebSocket = (
  url: string,
  { onMessage, onClose }: { onMessage?: (message: string) => void; onClose?: () => void },
) => {
  const [webSocket, setWebSocket] = useState<WebSocket>();

  function send(message: string) {
    webSocket?.send(message);
  }

  function openWebSocket() {
    const socket = new WebSocket(url);
    socket.onmessage = (messageEvent) => {
      onMessage && typeof messageEvent.data === "string" && onMessage(messageEvent.data);
    };
    socket.onclose = () => {
      // Retry connection every 5 seconds
      onClose && onClose();
      setTimeout(() => {
        openWebSocket();
      }, 5_000);
    };
    setWebSocket(socket);
  }

  useEffect(() => {
    openWebSocket();
    return () => {
      webSocket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return { send, webSocket };
};
