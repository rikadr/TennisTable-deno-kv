export interface GamebotConfig {
  client: string;
  enabled: boolean;
  apiToken?: string;
  gameBotChannelId?: string;
  pollingIntervalMs?: number;
}

export function getClientConfig(client: string): GamebotConfig {
  switch (client) {
    case "deepinsight":
      return {
        client,
        enabled: true,
        apiToken: Deno.env.get("GAMEBOT_TOKEN"),
        gameBotChannelId: Deno.env.get("GAMEBOT_CHANNEL_ID"),
        pollingIntervalMs: 60 * 1000, // 1 minute
      };
    default:
      return {
        client,
        enabled: false,
      };
  }
}
