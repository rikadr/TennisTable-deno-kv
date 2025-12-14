export interface GamebotConfig {
  enabled: boolean;
  apiToken?: string;
  gameBotChannelId?: string;
  pollingIntervalMs?: number;
}

export function getClientConfig(): GamebotConfig {
  const client = Deno.env.get("CLIENT");

  switch (client) {
    case "deepinsight":
      return {
        enabled: true,
        apiToken: Deno.env.get("GAMEBOT_TOKEN"),
        gameBotChannelId: Deno.env.get("GAMEBOT_CHANNEL_ID"),
        pollingIntervalMs: 60 * 1000, // 1 minute
      };
    default:
      return {
        enabled: false,
      };
  }
}
