import { useQuery } from "@tanstack/react-query";
import { httpClient } from "../common/http-client";

type ClientListDTO = { id: string; createdAt: number; broadcastsReceived: number }[];

export const DebugPage: React.FC = () => {
  const clientList = useQuery<ClientListDTO>({
    queryKey: ["ws-list"],
    queryFn: async () => {
      const url = new URL(`${process.env.REACT_APP_API_BASE_URL}/ws-list`);
      return httpClient(url, {
        method: "GET",
      }).then(async (response) => response.json() as Promise<ClientListDTO>);
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 1000,
  });
  return (
    <div className="w-64 mt-64 m-auto">
      <h2 className="text-lg mb-2">{clientList.data?.length} ws open</h2>
      {clientList.data?.map((client) => (
        <div key={client.id} className="flex gap-2 justify-between ">
          <p>{client.id}</p>
          <p>{formatTime(client.createdAt)}</p>
          <p>{client.broadcastsReceived}</p>
        </div>
      ))}
    </div>
  );
};

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false, // Use 24-hour format; set to `true` for 12-hour format
  });
}
