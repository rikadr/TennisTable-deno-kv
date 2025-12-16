import { getClientConfig } from "./client-config.ts";
import { processMatchesResponse } from "./process-matches.ts";

const config = getClientConfig();

if (config.enabled && config.gameBotChannelId) {
  console.log("Registering Gamebot cron job for client:", config.client);

  // Poll every minute
  Deno.cron("Gamebot Poller", "* * * * *", async () => {
    console.log("Running Gamebot Poller CRON job");
    try {
      const headers = new Headers();
      if (config.apiToken) {
        headers.set("X-Access-Token", config.apiToken);
      }
      console.log(headers);
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
      await processMatchesResponse(data);
    } catch (error) {
      console.error("Error polling Gamebot:", error);
    }
  });
} else {
  console.log("Gamebot poller disabled or missing configuration.");
}
