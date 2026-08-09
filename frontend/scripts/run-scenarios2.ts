import { loadEvents, build } from "./season7";
import { summarize, diff, findGame, movePlayedAt } from "./scenarios";
import { EventType, EventTypeEnum, GameScore } from "../src/client/client-db/event-store/event-types";

const events = loadEvents();
const baseTT = build(events);
const baseline = summarize(baseTT);

let t = Math.max(...events.map((e) => e.time)) + 1000;
const nextTime = () => ++t;

// How busy is the Sep 26 - Oct 6 grace window? (realism check for a moved game)
const graceStart = new Date("2025-09-26T17:00:00+02:00").getTime();
const graceEnd = new Date("2025-10-06T08:00:00+02:00").getTime();
console.log("=== Games in the S6->S7 grace period (Sep 26 17:00 - Oct 6 08:00) ===");
for (const g of baseTT.games.filter((g) => g.playedAt >= graceStart && g.playedAt < graceEnd)) {
  console.log(`  ${new Date(g.playedAt).toISOString()} ${baseTT.playerName(g.winner)} beat ${baseTT.playerName(g.loser)}`);
}

function addScore(
  gameId: string,
  setsWon: { gameWinner: number; gameLoser: number },
  setPoints: { gameWinner: number; gameLoser: number }[],
): GameScore {
  return { time: nextTime(), stream: gameId, type: EventTypeEnum.GAME_SCORE, data: { setsWon, setPoints } };
}

// ---------- Scenario 1b: move Krzysztof game to Mon Oct 6 07:30, just before season start ----------
{
  const g = findGame(baseTT, "Rikard", "Krzysztof", "2025-10-08");
  const mod = movePlayedAt(events, g.id, new Date("2025-10-06T07:30:00+02:00").getTime());
  diff(baseline, summarize(build(mod)), `1b) Move Rikard-Krzysztof game to Oct 6 07:30 (grace, ~2 days earlier)`);
}

// ---------- Scenario 1c: same but Friday Oct 3 15:00 ----------
{
  const g = findGame(baseTT, "Rikard", "Krzysztof", "2025-10-08");
  const mod = movePlayedAt(events, g.id, new Date("2025-10-03T15:00:00+02:00").getTime());
  diff(baseline, summarize(build(mod)), `1c) Move Rikard-Krzysztof game to Fri Oct 3 15:00 (grace)`);
}

// ---------- Scenario 3b: tuned set points, no close-call sets (margins >= 3), stronger wins ----------
{
  const christoffer = findGame(baseTT, "Fooa", "Christoffer", "2025-10-24");
  const peder = findGame(baseTT, "Fooa", "Peder", "2025-10-24");
  const alexander = findGame(baseTT, "Alexander", "Fooa", "2025-10-23");
  const rasmus = findGame(baseTT, "Rasmus", "Fooa", "2025-10-24");
  const mod: EventType[] = [
    ...events,
    // Fooa dominant 2-1 win over Christoffer: balls 30/47 = 63.8%
    addScore(christoffer.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 3 },
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 4 },
    ]),
    // Fooa solid 2-1 win over Peder: balls 31/50 = 62%
    addScore(peder.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 4 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 4 },
    ]),
    // Fooa narrow 2-1 loss to Alexander: Fooa balls 27/57 = 47.4%, no set within 2
    addScore(alexander.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 8 },
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 8 },
    ]),
    // Fooa narrow 2-1 loss to Rasmus: same shape
    addScore(rasmus.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 8 },
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 8 },
    ]),
  ];
  diff(baseline, summarize(build(mod)), `3b) Add tuned set points to 4 existing Fooa games (no close-call sets)`);
}

// ---------- Scenario 3c: minimal version - points on only 2 games (Christoffer + Alexander)? ----------
{
  const christoffer = findGame(baseTT, "Fooa", "Christoffer", "2025-10-24");
  const alexander = findGame(baseTT, "Alexander", "Fooa", "2025-10-23");
  const mod: EventType[] = [
    ...events,
    addScore(christoffer.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 3 },
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 4 },
    ]),
    addScore(alexander.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 8 },
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 8 },
    ]),
  ];
  diff(baseline, summarize(build(mod)), `3c) Points on only Christoffer + Alexander games (is it enough?)`);
}

// ---------- Scenario 7: combo - move Krzysztof game AND nothing else, but verify S7 winner margin under UTC too ----------
{
  const g = findGame(baseTT, "Rikard", "Krzysztof", "2025-10-08");
  const mod = movePlayedAt(events, g.id, new Date("2025-10-03T15:00:00+02:00").getTime());
  const tt = build(mod);
  const s7 = tt.seasons.getSeasons()[6];
  const lb = s7.getLeaderboard();
  console.log(`\n[TZ check] Season 7 under TZ=${process.env.TZ}: ` + lb.slice(0, 3).map((p, i) => `${i + 1}. ${tt.playerName(p.playerId)} ${p.seasonScore.toFixed(1)}`).join("  "));
}
