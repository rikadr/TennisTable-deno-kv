import { useEffect, useRef, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_MESSAGE {
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
  LATEST_EVENT = "latest-event",
  LIVE_GAME = "live-game",
}

export const useWebSocket = (
  url: string,
  { onMessage, onClose }: { onMessage?: (message: string) => void; onClose?: () => void },
) => {
  const [webSocket, setWebSocket] = useState<WebSocket>();
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);

  // Keep refs up to date so reconnections use the latest callbacks
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  function send(message: string) {
    webSocket?.send(message);
  }

  function openWebSocket() {
    const socket = new WebSocket(url);
    socket.onmessage = (messageEvent) => {
      onMessageRef.current && typeof messageEvent.data === "string" && onMessageRef.current(messageEvent.data);
    };
    socket.onclose = () => {
      // Retry connection every 5 seconds
      onCloseRef.current && onCloseRef.current();
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
