import { WS_MESSAGE } from "./use-web-socket";

export function useHeartbeat(getConnectionId: () => string | undefined, ws?: WebSocket): void {
  if (!ws) return;

  const interval = setInterval(() => {
    const connectionId = getConnectionId();
    if (!connectionId) return;
    ws.send(WS_MESSAGE.HEART_BEAT + ":" + connectionId);
  }, 10 * 1000);
  ws.addEventListener("close", () => clearInterval(interval));
}
