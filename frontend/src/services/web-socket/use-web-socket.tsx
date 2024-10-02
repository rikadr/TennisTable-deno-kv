import { useEffect, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_BROADCAST {
  RELOAD = "reload",
}

export const useWebSocket = (url: string) => {
  const [webSocket, setWebSocket] = useState<WebSocket>();
  const [latestMessage, setLatestMessage] = useState<string>();

  function send(message: string) {
    webSocket?.send(message);
  }

  function openWebSocket() {
    const socket = new WebSocket(url);
    socket.onopen = () => {};
    socket.onmessage = (messageEvent) => {
      setLatestMessage(messageEvent.data);
    };
    socket.onerror = (error) => {
      console.error("Websocket error", error);
    };
    socket.onclose = () => {
      // Retry connection
      setTimeout(openWebSocket, 1_000);
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

  return { send, latestMessage };
};
