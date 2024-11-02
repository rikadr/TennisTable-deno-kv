import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_BROADCAST } from "../hooks/use-web-socket";
import { useState } from "react";
import { classNames } from "../common/class-names";
import { useLocalStorage } from "usehooks-ts";

type Props = {
  children: React.ReactNode;
};

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();
  const [debugMessages, setDebugMessages] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useLocalStorage("show-debug-stats", false);

  function onMessage(message: string) {
    setDebugMessages([...debugMessages, formatTime() + " Message " + message]);
    if (message === WS_BROADCAST.RELOAD) {
      queryClient.invalidateQueries();
    }
  }

  const { webSocket } = useWebSocket(
    process.env.REACT_APP_API_BASE_URL + "/ws-updates",
    onMessage,
    () => setDebugMessages([...debugMessages, formatTime() + " Connected"]),
    () => setDebugMessages([...debugMessages, formatTime() + " Retrying"]),
    () => setDebugMessages([...debugMessages, formatTime() + " Closed"]),
    () => setDebugMessages([...debugMessages, formatTime() + " Error"]),
  );

  return (
    <div className="relative">
      {showDebug && webSocket && (
        <div
          className={classNames(
            "w-4 m-1 rounded-full aspect-square z-50 absolute top-24 md:top-14 right-0",
            webSocket.readyState === webSocket.OPEN && "bg-green-500",
            webSocket.readyState === webSocket.CONNECTING && "bg-blue-500",
            webSocket.readyState === webSocket.CLOSING && "bg-orange-500",
            webSocket.readyState === webSocket.CLOSED && "bg-red-500",
          )}
        />
      )}
      <div className="z-50 absolute top-24 md:top-14">
        {window.location.pathname === "/debug" && (
          <button className="p-1 bg-secondary-background text-secondary-text" onClick={() => setShowDebug(!showDebug)}>
            {showDebug ? "Hide " : "Show "} debug info
          </button>
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
