import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_MESSAGE } from "../hooks/use-web-socket";
import { useState } from "react";
import { classNames } from "../common/class-names";
import { useLocalStorage } from "usehooks-ts";
import { useHeartbeat } from "../hooks/use-heartbeat";

type Props = {
  children: React.ReactNode;
};

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();
  const [connectionId, setConnectionId] = useState<string>();
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useLocalStorage("show-debug-stats", false);

  function onMessage(message: string) {
    setDebugMessages([...debugMessages, formatTime() + " Message " + message]);
    if (message.startsWith(WS_MESSAGE.CONNECTION_ID)) {
      setConnectionId(message.split(":")[1]);
    }
    if (message === WS_MESSAGE.RELOAD) {
      queryClient.invalidateQueries();
    }
  }

  const { webSocket } = useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates", {
    onMessage,
    onClose() {
      setConnectionId(undefined);
    },
  });

  useHeartbeat(() => connectionId, webSocket);

  return (
    <div className="relative">
      {showDebug && webSocket && (
        <div
          className={classNames(
            "w-4 m-1 rounded-full aspect-square z-50 absolute top-20 md:top-12 right-0",
            webSocket.readyState === webSocket.OPEN && "bg-green-500",
            webSocket.readyState === webSocket.CONNECTING && "bg-blue-500",
            webSocket.readyState === webSocket.CLOSING && "bg-yellow-400",
            webSocket.readyState === webSocket.CLOSED && "bg-red-600",
          )}
        />
      )}
      <div className="z-50 absolute top-20 md:top-12 ">
        {window.location.pathname === "/debug" && (
          <div className="flex gap-4">
            <button
              className="p-1 bg-secondary-background text-secondary-text"
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? "Hide " : "Show "} debug info
            </button>
            {showDebug && (
              <button
                className="p-1 bg-secondary-background text-secondary-text"
                onClick={() => webSocket?.send(WS_MESSAGE.HEART_BEAT + ":" + connectionId)}
              >
                Send heart beat ws message
              </button>
            )}
          </div>
        )}
        {showDebug && (
          <div className="flex gap-4">
            <p>Connection ID: {connectionId}</p>
          </div>
        )}
        {showDebug && debugMessages.map((m, i, l) => <p key={i}>{l[l.length - 1 - i]}</p>)}
      </div>
      {children}
    </div>
  );
};

function formatTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Use 24-hour format; set to `true` for 12-hour format
  });
}
