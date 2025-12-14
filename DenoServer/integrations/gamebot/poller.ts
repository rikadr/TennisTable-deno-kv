import { getClientConfig } from "./client-config.ts";
import { processMatchesResponse } from "./process-matches.ts";

const config = getClientConfig();

if (config.enabled && config.gameBotChannelId) {
  console.log(
    `Registering Gamebot cron job for client: ${Deno.env.get("CLIENT")}`,
  );

  // Poll every minute
  Deno.cron("Gamebot Poller", "* * * * *", async () => {
    try {
      const headers = new Headers();
      if (config.apiToken) {
        headers.set("X-Access-Token", config.apiToken);
      }

      console.log(`Polling Gamebot API`);
      const response = await fetch(
        `https://gamebot2.playplay.io/api/matches?channel_id=${config.gameBotChannelId}`,
        {
          method: "GET",
          headers: headers,
        },
      );

      const text = await response.text();

      if (!response.ok) {
        console.error(
          `Gamebot fetch failed: ${response.status} ${response.statusText}`,
        );
        console.error("Response:", text);
        return;
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        console.log(
          "Gamebot poll response (text):",
          text.slice(0, 500) + "...",
        );
        return;
      }

      console.log(
        "Gamebot poll response (json):",
        JSON.stringify(data).slice(0, 500) + "...",
      );

      processMatchesResponse(data);
    } catch (error) {
      console.error("Error polling Gamebot:", error);
    }
  });
} else {
  console.log(
    "Gamebot poller disabled or missing configuration for this client.",
  );
}
