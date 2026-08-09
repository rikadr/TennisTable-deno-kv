/* Detailed season 7 analysis: matchups, per-game performances, boundary games. */
import { loadEvents, build } from "./season7";
import { Game } from "../src/client/client-db/event-store/projectors/games-projector";

const events = loadEvents();
const tt = build(events);
const seasons = tt.seasons.getSeasons();
const s7 = seasons[6];

const name = (id: string) => tt.playerName(id);

function perf(game: Game, isWinner: boolean): number {
  const winPerformance = isWinner ? 100 : 0;
  let setsPerformance = 0;
  if (game.score?.setsWon) {
    const setsWon = isWinner ? game.score.setsWon.gameWinner : game.score.setsWon.gameLoser;
    const totalSets = game.score.setsWon.gameWinner + game.score.setsWon.gameLoser;
    setsPerformance = (setsWon / totalSets) * 100;
  }
  let ballsPerformance = 0;
  if (game.score?.setPoints && game.score.setPoints.length > 0) {
    let w = 0,
      l = 0;
    for (const set of game.score.setPoints) {
      w += set.gameWinner;
      l += set.gameLoser;
    }
    ballsPerformance = ((isWinner ? w : l) / (w + l)) * 100;
  }
  return winPerformance / 4 + setsPerformance / 4 + ballsPerformance / 2;
}

const lb = s7.getLeaderboard();
console.log("=== Season 7 leaderboard (top 6) ===");
for (const p of lb.slice(0, 6)) {
  console.log(
    `${name(p.playerId)}: score=${p.seasonScore.toFixed(2)} matchups=${p.matchups.size} games=${p.totalGames}`,
  );
}

for (const who of ["Rikard", "Fooa"]) {
  const entry = lb.find((p) => name(p.playerId) === who)!;
  console.log(`\n=== ${who} matchups (season 7) ===`);
  const rows = Array.from(entry.matchups.entries()).sort((a, b) => b[1].bestPerformance - a[1].bestPerformance);
  for (const [opp, m] of rows) {
    // per-matchup game list with performances
    const games = s7.games.filter(
      (g) =>
        (g.winner === entry.playerId && g.loser === opp) || (g.loser === entry.playerId && g.winner === opp),
    );
    const perfList = games
      .map((g) => {
        const isW = g.winner === entry.playerId;
        const p = perf(g, isW);
        const score = g.score
          ? `${g.score.setsWon.gameWinner}-${g.score.setsWon.gameLoser}${g.score.setPoints ? " pts" : ""}`
          : "noscore";
        return `${isW ? "W" : "L"}${p.toFixed(1)}(${score}@${new Date(g.playedAt).toISOString().slice(5, 10)})`;
      })
      .join(" ");
    console.log(
      `  vs ${name(opp).padEnd(12)} best=${m.bestPerformance.toFixed(2).padStart(6)}  ${perfList}`,
    );
  }
}

// Which opponents did Fooa NOT play in season 7 (but exist / played in season 7)?
const s7players = new Set<string>();
for (const g of s7.games) {
  s7players.add(g.winner);
  s7players.add(g.loser);
}
const fooa = lb.find((p) => name(p.playerId) === "Fooa")!;
console.log("\n=== Season-7-active players Fooa never played in season 7 ===");
for (const pid of s7players) {
  if (pid !== fooa.playerId && !fooa.matchups.has(pid)) {
    console.log(`  ${name(pid)}`);
  }
}

// Games near the season 7 end boundary and start of season 8 (candidates for date moves)
console.log("\n=== Games between Dec 12 2025 and Jan 20 2026 involving Rikard or Fooa ===");
const rikard = lb.find((p) => name(p.playerId) === "Rikard")!.playerId;
const from = Date.UTC(2025, 11, 10);
const to = Date.UTC(2026, 0, 20);
for (const g of tt.games) {
  if (g.playedAt < from || g.playedAt > to) continue;
  if (![g.winner, g.loser].includes(rikard) && ![g.winner, g.loser].includes(fooa.playerId)) continue;
  const score = g.score
    ? `${g.score.setsWon.gameWinner}-${g.score.setsWon.gameLoser}${g.score.setPoints ? "+pts" : ""}`
    : "noscore";
  console.log(
    `  ${new Date(g.playedAt).toISOString()} ${name(g.winner)} beat ${name(g.loser)} (${score}) id=${g.id} wPerf=${perf(g, true).toFixed(1)} lPerf=${perf(g, false).toFixed(1)}`,
  );
}
