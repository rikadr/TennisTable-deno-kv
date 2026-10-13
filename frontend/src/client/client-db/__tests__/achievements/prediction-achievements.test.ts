import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// The achievements that read the predictions must be deterministic, and a new
// game must never change an award of an earlier game.

const PREDICTION_TYPES = [
  "100-percent-confidence",
  "perfect-match",
  "against-all-odds",
  "biggest-upset",
  "clockwork",
  "prophecy-fulfilled",
];

const DAY = 24 * 60 * 60 * 1000;
const FIRST_DAY = new Date(2024, 0, 1, 12).getTime();

// A league of 8 players with 400 games over 80 days. Each player has a fixed
// skill, and a fixed seed gives the same games each time.
function league(): EventType[] {
  let seed = 7;
  const random = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const skill = ids.map((_, i) => i * 0.4);
  const events: EventType[] = ids.map((id, i) => ({
    type: EventTypeEnum.PLAYER_CREATED,
    stream: id,
    time: i + 1,
    data: { name: id },
  }));
  for (let i = 0; i < 400; i++) {
    const p1 = Math.floor(random() * ids.length);
    const p2 = (p1 + 1 + Math.floor(random() * (ids.length - 1))) % ids.length;
    const p1Wins = random() < 1 / (1 + Math.exp(skill[p2] - skill[p1]));
    const time = FIRST_DAY + Math.floor(i / 5) * DAY + (i % 5) * 60 * 1000;
    events.push({
      type: EventTypeEnum.GAME_CREATED,
      stream: `g${i + 1}`,
      time,
      data: { winner: ids[p1Wins ? p1 : p2], loser: ids[p1Wins ? p2 : p1], playedAt: time },
    });
  }
  return events;
}

const predictionAwards = (tt: TennisTable) => {
  tt.achievements.calculateAchievements();
  return [...tt.achievements.achievementMap.values()]
    .flat()
    .filter((a) => PREDICTION_TYPES.includes(a.type))
    .map((a) => JSON.stringify(a))
    .sort();
};

describe("Prediction achievements", () => {
  it("give the same awards each time", () => {
    const events = league();
    const first = predictionAwards(new TennisTable({ events, gameLimitForRankedOverride: 5 }));
    const second = predictionAwards(new TennisTable({ events, gameLimitForRankedOverride: 5 }));

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it("keep the awards of earlier days when games are added", () => {
    const events = league();
    // The first 40 days. Each day has 5 games, so the cut is at the end of a day.
    const cut = FIRST_DAY + 40 * DAY - 12 * 60 * 60 * 1000;
    const earlier = events.filter((event) => event.type !== EventTypeEnum.GAME_CREATED || event.time < cut);

    const partial = predictionAwards(new TennisTable({ events: earlier, gameLimitForRankedOverride: 5 }));
    const full = predictionAwards(new TennisTable({ events, gameLimitForRankedOverride: 5 })).filter(
      (award) => JSON.parse(award).earnedAt < cut,
    );

    expect(partial.length).toBeGreaterThan(0);
    expect(full).toEqual(partial);
  });
});
