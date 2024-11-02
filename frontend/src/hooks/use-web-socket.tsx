import { useEffect, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_BROADCAST {
  RELOAD = "reload",
  CONNECTION_ID = "connection-id",
}

export const useWebSocket = (
  url: string,
  onMessage: (message: string) => void,
  onConnect: () => void,
  onRetry: () => void,
  onClose: () => void,
  onError: () => void,
) => {
  const [webSocket, setWebSocket] = useState<WebSocket>();

  function send(message: string) {
    webSocket?.send(message);
  }

  function openWebSocket() {
    const socket = new WebSocket(url);
    socket.onopen = () => {
      onConnect();
    };
    socket.onmessage = (messageEvent) => {
      onMessage(messageEvent.data);
    };
    socket.onerror = (error) => {
      console.error("Websocket error", error);
      onError();
    };
    socket.onclose = () => {
      // Retry connection
      onClose();
      setTimeout(() => {
        onRetry();
        openWebSocket();
      }, 2_000);
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
