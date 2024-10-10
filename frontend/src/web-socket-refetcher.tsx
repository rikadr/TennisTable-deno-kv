import { useQueryClient } from "@tanstack/react-query";
import { useWebSocket, WS_BROADCAST } from "./services/web-socket/use-web-socket";

type Props = {
  children: React.ReactNode;
};

export const WebSocketRefetcher: React.FC<Props> = ({ children }) => {
  const queryClient = useQueryClient();

  const { latestMessage } = useWebSocket(process.env.REACT_APP_API_BASE_URL + "/ws-updates");
  if (latestMessage === WS_BROADCAST.RELOAD) {
    // Server has new data and client should refetch.
    queryClient.invalidateQueries();
  }
  return children;
};
