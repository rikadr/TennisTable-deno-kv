/**
 * One-time migration script: reads a KV dump JSON file and inserts into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx \
 *   deno run --allow-net --allow-read --allow-env scripts/migrate-dump-to-supabase.ts <dump-file.json>
 */

import { createClient } from "npm:@supabase/supabase-js@^2";

const dumpFile = Deno.args[0];
if (!dumpFile) {
  console.error("Usage: deno run ... scripts/migrate-dump-to-supabase.ts <dump-file.json>");
  Deno.exit(1);
}

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  Deno.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);
const data = JSON.parse(await Deno.readTextFile(dumpFile));

console.log(`Loaded ${data.length} entries from ${dumpFile}`);

let events = 0;
let users = 0;
let liveGames = 0;
let kvEntries = 0;
let skipped = 0;

for (const entry of data) {
  const key = entry.key as (string | number)[];

  if (key[0] === "event") {
    const event = entry.value;
    const { error } = await client.from("events").upsert({
      time: event.time,
      stream: event.stream,
      type: event.type,
      data: event.data,
    });
    if (error) {
      console.error(`Failed to insert event ${event.time}:`, error.message);
    } else {
      events++;
    }
  } else if (key[0] === "user") {
    const user = entry.value;
    const { error } = await client.from("users").upsert({
      username: user.username,
      password: user.password,
      role: user.role,
    });
    if (error) {
      console.error(`Failed to insert user ${user.username}:`, error.message);
    } else {
      users++;
    }
  } else if (key[0] === "live-game") {
    const { error } = await client.from("live_game").upsert({
      id: 1,
      state: entry.value,
    });
    if (error) {
      console.error("Failed to insert live game:", error.message);
    } else {
      liveGames++;
    }
  } else {
    const kvKey = typeof key[0] === "string" ? key.join(":") : String(key[0]);
    const { error } = await client.from("key_value").upsert({
      key: kvKey,
      value: entry.value,
    });
    if (error) {
      console.error(`Failed to insert kv ${kvKey}:`, error.message);
    } else {
      kvEntries++;
    }
  }

  const total = events + users + liveGames + kvEntries + skipped;
  if (total % 100 === 0) {
    console.log(`Progress: ${total}/${data.length}`);
  }
}

console.log("\nMigration complete:");
console.log(`  Events: ${events}`);
console.log(`  Users: ${users}`);
console.log(`  Live games: ${liveGames}`);
console.log(`  Key-value: ${kvEntries}`);
console.log(`  Skipped: ${skipped}`);
