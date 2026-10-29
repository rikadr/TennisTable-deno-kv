import { CLIENTS } from "../../client.ts";
import { getClientConfig } from "./client-config.ts";
import { processMatchesResponse } from "./process-matches.ts";

for (const client of CLIENTS) {
  const config = getClientConfig(client);
  if (!config.enabled || !config.gameBotChannelId) {
    continue;
  }

  // Poll twice a day, at 12:00 and 17:00
  Deno.cron(`Gamebot Poller ${client}`, "0 12,17 * * *", async () => {
    try {
      const headers = new Headers();
      if (config.apiToken) {
        headers.set("X-Access-Token", config.apiToken);
      }
      const response = await fetch(
        `https://gamebot2.playplay.io/api/matches?channel_id=${config.gameBotChannelId}&size=10`,
        { method: "GET", headers: headers },
      );

      const text = await response.text();

      if (!response.ok) {
        console.error(`Gamebot fetch failed: ${response.status} ${response.statusText}`);
        console.error("Response:", text);
        return;
      }

      const data = JSON.parse(text);
      await processMatchesResponse(client, data);
    } catch (error) {
      console.error("Error polling Gamebot:", error);
    }
  });
}
