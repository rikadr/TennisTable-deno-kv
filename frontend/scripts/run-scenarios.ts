import { loadEvents, build } from "./season7";
import { summarize, diff, findGame, movePlayedAt } from "./scenarios";
import { EventType, EventTypeEnum, GameScore, GameCreated, GameDeleted } from "../src/client/client-db/event-store/event-types";

const events = loadEvents();
const baseTT = build(events);
const baseline = summarize(baseTT);

let t = Math.max(...events.map((e) => e.time)) + 1000;
const nextTime = () => ++t;

console.log("=== Tournaments in baseline ===");
for (const tour of baseTT.tournaments.getTournaments()) {
  console.log(
    `  ${tour.tournamentConfig.name}: start=${new Date(tour.startDate).toISOString().slice(0, 10)} groupPlay=${
      tour.tournamentConfig.groupPlay
    } winner=${baseTT.playerName(tour.winner)} ended=${tour.bracket?.bracketEnded ? new Date(tour.bracket.bracketEnded).toISOString().slice(0, 10) : "no"}`,
  );
}

const grace = new Date("2025-10-03T12:00:00+02:00").getTime(); // between season 6 end (Sep 26) and season 7 start (Oct 6 08:00)

function addScore(
  gameId: string,
  setsWon: { gameWinner: number; gameLoser: number },
  setPoints: { gameWinner: number; gameLoser: number }[],
): GameScore {
  return { time: nextTime(), stream: gameId, type: EventTypeEnum.GAME_SCORE, data: { setsWon, setPoints } };
}

// ---------- Scenario 1: move Rikard's only Krzysztof game into the pre-season grace period ----------
{
  const g = findGame(baseTT, "Rikard", "Krzysztof", "2025-10-08");
  console.log(`\nKrzysztof game: id=${g.id} playedAt=${new Date(g.playedAt).toISOString()}`);
  const mod = movePlayedAt(events, g.id, grace);
  diff(baseline, summarize(build(mod)), `1) Move Rikard-Krzysztof game (Oct 8) back to Oct 3 (grace period, ~5 days)`);
}

// ---------- Scenario 2: move Rikard's only Magnus game into the grace period ----------
{
  const g = findGame(baseTT, "Rikard", "Magnus", "2025-10-17");
  const mod = movePlayedAt(events, g.id, grace + 3600_000);
  diff(baseline, summarize(build(mod)), `2) Move Rikard-Magnus game (Oct 17) back to Oct 3 (grace period, ~14 days)`);
}

// ---------- Scenario 3: add set points to Fooa games that have sets but no points ----------
{
  const christoffer = findGame(baseTT, "Fooa", "Christoffer", "2025-10-24");
  const peder = findGame(baseTT, "Fooa", "Peder", "2025-10-24");
  const alexander = findGame(baseTT, "Alexander", "Fooa", "2025-10-23");
  const rasmus = findGame(baseTT, "Rasmus", "Fooa", "2025-10-24");
  const mod: EventType[] = [
    ...events,
    addScore(christoffer.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 4 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 5 },
    ]),
    addScore(peder.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 6 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 7 },
    ]),
    addScore(alexander.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 10, gameLoser: 12 },
      { gameWinner: 11, gameLoser: 9 },
    ]),
    addScore(rasmus.id, { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 12, gameLoser: 10 },
    ]),
  ];
  diff(baseline, summarize(build(mod)), `3) Add set points to 4 existing Fooa games (Christoffer, Peder W; Alexander, Rasmus L)`);
}

// ---------- Scenario 4: add one new game: Fooa beats Mads (never played in S7) ----------
{
  const playedAt = new Date("2025-11-20T13:30:00+01:00").getTime();
  const created: GameCreated = {
    time: nextTime(),
    stream: "sim_fooa_mads1",
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner: baseTT.players.find((p) => p.name === "Fooa")!.id, loser: baseTT.players.find((p) => p.name === "Mads")!.id },
  };
  const mod: EventType[] = [
    ...events,
    created,
    addScore("sim_fooa_mads1", { gameWinner: 2, gameLoser: 0 }, [
      { gameWinner: 11, gameLoser: 6 },
      { gameWinner: 11, gameLoser: 8 },
    ]),
  ];
  diff(baseline, summarize(build(mod)), `4) Add 1 new game: Fooa beats Mads 2-0 (11-6, 11-8) on Nov 20`);
}

// ---------- Scenario 5: add one new game: Fooa beats Alexander (revenge) ----------
{
  const playedAt = new Date("2025-12-01T14:00:00+01:00").getTime();
  const created: GameCreated = {
    time: nextTime(),
    stream: "sim_fooa_alex1",
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner: baseTT.players.find((p) => p.name === "Fooa")!.id, loser: baseTT.players.find((p) => p.name === "Alexander")!.id },
  };
  const mod: EventType[] = [
    ...events,
    created,
    addScore("sim_fooa_alex1", { gameWinner: 2, gameLoser: 1 }, [
      { gameWinner: 11, gameLoser: 8 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 7 },
    ]),
  ];
  diff(baseline, summarize(build(mod)), `5) Add 1 new game: Fooa beats Alexander 2-1 (11-8, 9-11, 11-7) on Dec 1`);
}

// ---------- Scenario 6: delete the Rikard-Krzysztof game ----------
{
  const g = findGame(baseTT, "Rikard", "Krzysztof", "2025-10-08");
  const del: GameDeleted = { time: nextTime(), stream: g.id, type: EventTypeEnum.GAME_DELETED, data: null };
  const mod: EventType[] = [...events, del];
  diff(baseline, summarize(build(mod)), `6) Delete the Rikard-Krzysztof game (Oct 8) entirely`);
}
