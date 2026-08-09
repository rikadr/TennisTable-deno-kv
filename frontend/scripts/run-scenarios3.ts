import { loadEvents, build } from "./season7";
import { summarize, diff, findGame, movePlayedAt } from "./scenarios";

const events = loadEvents();
const baseTT = build(events);
const baseline = summarize(baseTT);

// Inspect the grace-period Fooa games' scores
for (const spec of [
  ["Fooa", "Peder", "2025-09-30"],
  ["Fooa", "Rikard", "2025-10-02"],
  ["Fooa", "Mads", "2025-10-03"],
  ["Fooa", "Peder", "2025-10-03"],
] as const) {
  const g = findGame(baseTT, spec[0], spec[1], spec[2]);
  const game = baseTT.games.find((x) => x.id === g.id)!;
  console.log(`${spec[0]} beat ${spec[1]} @${spec[2]}: score=${JSON.stringify(game.score)} id=${g.id}`);
}

// Milestone game #1500 date (0-based index 1499)
console.log(`\nGame #1500 in league history: ${new Date(baseTT.games[1499].playedAt).toISOString()} ${baseTT.playerName(baseTT.games[1499].winner)} beat ${baseTT.playerName(baseTT.games[1499].loser)}`);
console.log(`Total games: ${baseTT.games.length}`);

// Scenario 8: move Fooa-Mads game from Oct 3 (grace) to Oct 6 (inside season 7), +3 days same time
{
  const g = findGame(baseTT, "Fooa", "Mads", "2025-10-03");
  const mod = movePlayedAt(events, g.id, g.playedAt + 3 * 24 * 3600 * 1000);
  diff(baseline, summarize(build(mod)), `8) Move Fooa-Mads game from Oct 3 (grace) to Oct 6 (inside season 7)`);
}

// Scenario 9: same but move it to a quiet midweek slot Wed Oct 8 (\"+5 days\")
{
  const g = findGame(baseTT, "Fooa", "Mads", "2025-10-03");
  const mod = movePlayedAt(events, g.id, new Date("2025-10-08T14:31:00+02:00").getTime());
  diff(baseline, summarize(build(mod)), `9) Move Fooa-Mads game from Oct 3 (grace) to Wed Oct 8 14:31 (inside season 7)`);
}
