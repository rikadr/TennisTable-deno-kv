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

/**
 * Black or white, whichever reads better on the color. The colors of the
 * players cover the full range from pale to near black.
 */
export function readableTextColor(hexColor: string): "#000000" | "#ffffff" {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "#000000";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);

  // Perceived brightness, weighted per channel as the human eye sees them.
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
  return brightness > 140 ? "#000000" : "#ffffff";
}
