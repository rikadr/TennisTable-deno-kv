import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_BROADCAST } from "../services/web-socket/use-web-socket";

type Props = {
  children: React.ReactNode;
};

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();

  function onMessage(message: string) {
    if (message === WS_BROADCAST.RELOAD) {
      queryClient.invalidateQueries();
    }
  }

  useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates", onMessage);

  return children;
};
