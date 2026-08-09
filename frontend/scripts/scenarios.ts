/* Scenario harness: apply event-list transforms, rebuild TennisTable, diff outcomes. */
import { loadEvents, build } from "./season7";
import { EventType } from "../src/client/client-db/event-store/event-types";
import { TennisTable } from "../src/client/client-db/tennis-table";

export type Summary = {
  seasons: { start: string; standings: { name: string; score: number; rank: number }[] }[];
  achievements: Map<string, Map<string, number>>; // playerName -> type -> count
  elo: { name: string; elo: number; rank: number; ranked: boolean }[];
  tournaments: { name: string; winner: string | undefined; ended: number | undefined; played: number }[];
  hallOfFame: { name: string; rank: number }[];
};

export function summarize(tt: TennisTable): Summary {
  const name = (id: string | undefined) => (id ? tt.playerName(id) : "undefined");

  const seasons = tt.seasons.getSeasons().map((s) => ({
    start: new Date(s.start).toISOString().slice(0, 10),
    standings: s.getLeaderboard().map((p, i) => ({
      name: name(p.playerId),
      score: Math.round(p.seasonScore * 100) / 100,
      rank: i + 1,
    })),
  }));

  tt.achievements.calculateAchievements();
  const achievements = new Map<string, Map<string, number>>();
  for (const [pid, list] of tt.achievements.achievementMap.entries()) {
    const counts = new Map<string, number>();
    for (const a of list) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
    achievements.set(name(pid), counts);
  }

  const lb = tt.leaderboard.getLeaderboard();
  const elo: Summary["elo"] = [];
  lb.rankedPlayers.forEach((p: { name: string; elo: number; rank?: number }, i: number) =>
    elo.push({ name: p.name, elo: Math.round(p.elo * 10) / 10, rank: i + 1, ranked: true }),
  );
  lb.unrankedPlayers.forEach((p: { name: string; elo: number }) =>
    elo.push({ name: p.name, elo: Math.round(p.elo * 10) / 10, rank: -1, ranked: false }),
  );

  const tournaments = tt.tournaments.getTournaments().map((t) => ({
    name: t.tournamentConfig.name,
    winner: name(t.winner),
    ended: t.bracket?.bracketEnded,
    played: t.bracket ? t.bracket.getCompletedGames().length : -1,
  }));

  const hallOfFame = tt.hallOfFame.getHallOfFame().map((e, i) => ({ name: name(e.playerId), rank: i + 1 }));

  return { seasons, achievements, elo, tournaments, hallOfFame };
}

export function diff(base: Summary, mod: Summary, label: string) {
  console.log(`\n########## SCENARIO: ${label} ##########`);

  // Seasons: rank changes in every season
  for (let i = 0; i < Math.max(base.seasons.length, mod.seasons.length); i++) {
    const b = base.seasons[i];
    const m = mod.seasons[i];
    if (!b || !m) {
      console.log(`  Season ${i + 1} exists only in ${b ? "base" : "modified"}!`);
      continue;
    }
    const bRank = new Map(b.standings.map((p) => [p.name, p]));
    const changes: string[] = [];
    for (const p of m.standings) {
      const bp = bRank.get(p.name);
      if (!bp) {
        changes.push(`${p.name} NEW at rank ${p.rank} (${p.score})`);
      } else if (bp.rank !== p.rank || Math.abs(bp.score - p.score) > 0.005) {
        changes.push(`${p.name}: rank ${bp.rank}->${p.rank}, score ${bp.score}->${p.score}`);
      }
    }
    for (const p of b.standings) {
      if (!m.standings.some((x) => x.name === p.name)) changes.push(`${p.name} REMOVED (was rank ${p.rank})`);
    }
    if (changes.length) {
      console.log(`  Season ${i + 1} (${b.start}):`);
      for (const c of changes) console.log(`    ${c}`);
    }
  }

  // Achievements
  const allPlayers = new Set([...base.achievements.keys(), ...mod.achievements.keys()]);
  const achChanges: string[] = [];
  for (const p of allPlayers) {
    const b = base.achievements.get(p) ?? new Map();
    const m = mod.achievements.get(p) ?? new Map();
    const types = new Set([...b.keys(), ...m.keys()]);
    for (const t of types) {
      const bc = b.get(t) ?? 0;
      const mc = m.get(t) ?? 0;
      if (bc !== mc) achChanges.push(`${p}: ${t} ${bc}->${mc}`);
    }
  }
  console.log(`  Achievement changes (${achChanges.length}):`);
  for (const c of achChanges) console.log(`    ${c}`);

  // Elo
  const bElo = new Map(base.elo.map((p) => [p.name, p]));
  const eloChanges: string[] = [];
  for (const p of mod.elo) {
    const bp = bElo.get(p.name);
    if (!bp) {
      eloChanges.push(`${p.name} NEW elo=${p.elo}`);
      continue;
    }
    const d = p.elo - bp.elo;
    if (Math.abs(d) > 0.05 || bp.rank !== p.rank) {
      eloChanges.push(
        `${p.name}: elo ${bp.elo}->${p.elo} (${d > 0 ? "+" : ""}${d.toFixed(1)}), rank ${bp.rank}->${p.rank}`,
      );
    }
  }
  console.log(`  Current-Elo changes (${eloChanges.length}):`);
  for (const c of eloChanges) console.log(`    ${c}`);

  // Tournaments
  for (let i = 0; i < base.tournaments.length; i++) {
    const b = base.tournaments[i];
    const m = mod.tournaments[i];
    if (JSON.stringify(b) !== JSON.stringify(m)) {
      console.log(`  Tournament changed: ${JSON.stringify(b)} -> ${JSON.stringify(m)}`);
    }
  }

  // Hall of fame
  const bHof = new Map(base.hallOfFame.map((e) => [e.name, e.rank]));
  const hofChanges: string[] = [];
  for (const e of mod.hallOfFame) {
    const br = bHof.get(e.name);
    if (br !== e.rank) hofChanges.push(`${e.name}: HoF rank ${br}->${e.rank}`);
  }
  if (hofChanges.length) {
    console.log(`  Hall of Fame changes:`);
    for (const c of hofChanges) console.log(`    ${c}`);
  } else {
    console.log(`  Hall of Fame: unchanged`);
  }

  // Season 7 top-3 statement
  const s7 = mod.seasons[6];
  console.log(
    `  >> Season 7 result: ${s7.standings
      .slice(0, 3)
      .map((p) => `${p.rank}. ${p.name} (${p.score})`)
      .join("  ")}`,
  );
}

// ---------- helpers to locate games ----------
export function findGame(
  tt: TennisTable,
  winner: string,
  loser: string,
  dayIso: string, // "2025-10-08"
): { id: string; playedAt: number } {
  const w = tt.games.filter(
    (g) =>
      tt.playerName(g.winner) === winner &&
      tt.playerName(g.loser) === loser &&
      new Date(g.playedAt).toISOString().slice(0, 10) === dayIso,
  );
  if (w.length !== 1) throw new Error(`findGame(${winner},${loser},${dayIso}): found ${w.length}`);
  return { id: w[0].id, playedAt: w[0].playedAt };
}

export function movePlayedAt(events: EventType[], gameId: string, newPlayedAt: number): EventType[] {
  return events.map((e) =>
    e.type === "GAME_CREATED" && e.stream === gameId
      ? { ...e, data: { ...e.data, playedAt: newPlayedAt } }
      : e,
  ) as EventType[];
}

let addedTime = 1754700000000; // unique event times for appended events
export function nextTime() {
  return ++addedTime;
}
