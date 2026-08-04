import { useEffect, useRef, useState } from "react";
/**
 * Defined messages that can be broadcast to connected clients
 */
export enum WS_MESSAGE {
  CONNECTION_ID = "connection-id",
  HEART_BEAT = "heart-beat",
  LATEST_EVENT = "latest-event",
  LIVE_GAME = "live-game",
  CLEAR_CACHE = "clear-cache",
}

const RECONNECT_DELAY_MS = 5_000;

/**
 * The WebSocket constructor takes a `ws:` or a `wss:` url. Most browsers accept
 * an `http:` or an `https:` url and map it, but some throw instead. The api
 * base url is an http url, so map it here.
 */
function toWebSocketUrl(url: string): string {
  if (url.startsWith("https://")) {
    return "wss://" + url.slice("https://".length);
  }
  if (url.startsWith("http://")) {
    return "ws://" + url.slice("http://".length);
  }
  return url;
}

export const useWebSocket = (
  url: string,
  { onMessage, onClose }: { onMessage?: (message: string) => void; onClose?: () => void },
) => {
  const [webSocket, setWebSocket] = useState<WebSocket>();
  const onMessageRef = useRef(onMessage);
  const onCloseRef = useRef(onClose);
  const socketRef = useRef<WebSocket>();
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Keep refs up to date so reconnections use the latest callbacks
  useEffect(() => { onMessageRef.current = onMessage; }, [onMessage]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  function send(message: string) {
    webSocket?.send(message);
  }

  useEffect(() => {
    const socketUrl = toWebSocketUrl(url);
    let isMounted = true;

    function scheduleReconnect() {
      if (isMounted === false) return;
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(openWebSocket, RECONNECT_DELAY_MS);
    }

    function openWebSocket() {
      if (isMounted === false) return;

      let socket: WebSocket;
      try {
        socket = new WebSocket(socketUrl);
      } catch (error) {
        console.error("Failed to open the web socket:", error);
        scheduleReconnect();
        return;
      }

      socketRef.current = socket;
      socket.onmessage = (messageEvent) => {
        onMessageRef.current && typeof messageEvent.data === "string" && onMessageRef.current(messageEvent.data);
      };
      socket.onclose = () => {
        onCloseRef.current && onCloseRef.current();
        // A socket the hook has already replaced must not open another one.
        if (socketRef.current !== socket) return;
        scheduleReconnect();
      };
      setWebSocket(socket);
    }

    /**
     * A device that sleeps or a tab that goes to the background can lose the
     * connection with no close event. Reconnect as soon as the page is visible
     * again, so the screen does not wait for the next heartbeat to time out.
     */
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;

      const state = socketRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

      clearTimeout(reconnectTimeoutRef.current);
      openWebSocket();
    }

    openWebSocket();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeoutRef.current);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      socketRef.current?.close();
    };
  }, [url]);

  return { send, webSocket };
};
