import { optioPlayersById } from "../client/client-config/clients/optio-client";

export function stringToColor(playerId?: string): string {
  if (!playerId) return "#4338ca";

  if (playerId in optioPlayersById) {
    playerId = optioPlayersById[playerId as keyof typeof optioPlayersById];
  }

  switch (playerId) {
    case "Peder":
    case "Rikard":
    case "Simone":
      playerId = playerId.toLowerCase();
  }

  let hash = 0;
  for (let i = 0; i < playerId.length; i++) {
    hash = playerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = "#";
  const brightnessThreshold = 100; // Ensures brightness is above 50%
  for (let i = 0; i < 3; i++) {
    let value = (hash >> (i * 8)) & 0xff;
    value = value < brightnessThreshold ? value * 1.11 : value;
    color += ("00" + value.toString(16)).substr(-2);
  }
  return color;
}
