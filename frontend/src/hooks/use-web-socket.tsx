import { useEffect, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_MESSAGE {
  RELOAD = "reload",
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
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
    socket.onopen = () => {};
    socket.onmessage = (messageEvent) => {
      onMessage && onMessage(messageEvent.data);
    };
    socket.onerror = (error) => {
      console.error("Websocket error", error);
    };
    socket.onclose = () => {
      // Retry connection
      onClose && onClose();
      setTimeout(() => {
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
