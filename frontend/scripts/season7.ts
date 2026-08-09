/* Ad-hoc analysis harness: replay an events dump and inspect seasons.
 *
 * Usage (from /frontend):
 *   npm i --no-save tsx
 *   EVENTS_DUMP=/path/to/events-backup.json TZ=Europe/Oslo \
 *     npx tsx --require ./scripts/register-assets.cjs scripts/season7.ts
 *
 * The other scripts in this folder (run-scenarios*.ts) replay modified event
 * lists and diff seasons, achievements, Elo, tournaments and hall of fame
 * against the baseline. Run them the same way.
 */
import fs from "fs";
import { TennisTable } from "../src/client/client-db/tennis-table";
import { EventType } from "../src/client/client-db/event-store/event-types";

const DUMP = process.env.EVENTS_DUMP ?? "";
if (!DUMP) {
  throw new Error("Set EVENTS_DUMP to the path of an events backup JSON file");
}

export function loadEvents(): EventType[] {
  return JSON.parse(fs.readFileSync(DUMP, "utf8")) as EventType[];
}

export function build(events: EventType[]): TennisTable {
  return new TennisTable({ events });
}

function fmt(ts: number): string {
  return new Date(ts).toISOString().slice(0, 16).replace("T", " ");
}

if (require.main === module) {
  const events = loadEvents();
  const tt = build(events);
  const seasons = tt.seasons.getSeasons();
  console.log(`Total events: ${events.length}, games: ${tt.games.length}`);
  seasons.forEach((s, i) => {
    const lb = s.getLeaderboard();
    const top = lb
      .slice(0, 4)
      .map((p) => `${tt.playerName(p.playerId)}=${p.seasonScore.toFixed(1)}`)
      .join(", ");
    console.log(
      `Season ${i + 1}: ${fmt(s.start)} -> ${fmt(s.end)} | games=${s.games.length} | ${top}`,
    );
  });
}
