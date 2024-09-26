import { useEffect, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_BROADCAST {
  RELOAD = "reload",
}

export const useWebSocket = (url: string) => {
  const [latestMessage, setLatestMessage] = useState<string>();
  const [webSocket, setWebSocket] = useState<WebSocket>();

  function send(message: string) {
    webSocket?.send(message);
  }

  useEffect(() => {
    const socket = new WebSocket(url);
    socket.onmessage = (messageEvent) => {
      setLatestMessage(messageEvent.data);
    };
    socket.onerror = (error) => {
      console.error("Websocket error", error);
    };
    setWebSocket(socket);
    return () => {
      socket.close();
    };
  }, [url]);

  return { send, latestMessage };
};
