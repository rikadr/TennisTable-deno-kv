import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Climber fires once when a ranked player's current Elo is at least 300
// above their all-time low — where the low is tracked from the moment
// the player first becomes ranked and only updates downward.

describe("Climber Achievement", () => {
  const createPlayer = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // A loses 5 games against fresh opponents (becomes ranked at ~927 Elo),
  // then plays `winCount` wins against more fresh opponents. With 30 wins
  // A climbs to ~1257 Elo (~+330 from the all-time low).
  const buildClimb = (winCount: number): EventType[] => {
    const events: EventType[] = [createPlayer("a", 1)];
    let t = 100;
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`L${i}`, 10 + i));
      events.push(game(`gL${i}`, t++, `L${i}`, "a"));
    }
    for (let i = 0; i < winCount; i++) {
      events.push(createPlayer(`W${i}`, 1000 + i));
      events.push(game(`gW${i}`, t++, "a", `W${i}`));
    }
    return events;
  };

  it("awards Climber after climbing 300 Elo from the all-time low", () => {
    const tt = new TennisTable({ events: buildClimb(30) });
    tt.achievements.calculateAchievements();

    const climber = tt.achievements.getAchievements("a").filter((x) => x.type === "climber");
    expect(climber).toHaveLength(1);
  });

  it("does NOT fire when the climb is less than 300 Elo", () => {
    const tt = new TennisTable({ events: buildClimb(10) });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "climber")).toHaveLength(0);
  });

  it("does NOT fire for players who never became ranked", () => {
    // Only 4 games — never crosses gameLimitForRanked.
    const events: EventType[] = [createPlayer("a", 1), createPlayer("b", 2)];
    for (let i = 0; i < 4; i++) {
      events.push(game(`g${i}`, 100 + i, "a", "b"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "climber")).toHaveLength(0);
  });

  it("tracks current progression as (current Elo − all-time low)", () => {
    const tt = new TennisTable({ events: buildClimb(10) });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("a");
    expect(progression.climber.target).toBe(300);
    expect(progression.climber.current).toBeGreaterThan(0);
    expect(progression.climber.current).toBeLessThan(300);
    expect(progression.climber.earned).toBe(0);
  });

  it("progression is 0 for an unranked player (never reached the threshold)", () => {
    // Only 4 games — A never crossed gameLimitForRanked, so no low recorded.
    const events: EventType[] = [createPlayer("a", 1), createPlayer("b", 2)];
    for (let i = 0; i < 4; i++) {
      events.push(game(`g${i}`, 100 + i, "a", "b"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getPlayerProgression("a").climber.current).toBe(0);
  });

  it("all-time low updates downward when a ranked player drops below it", () => {
    // A wins 5 games (ranked at ~1073) then loses 5 (drops below 1073).
    // The recorded low should be the post-loss Elo, not the first-ranked
    // one. Progression after a partial recovery should reflect that.
    const events: EventType[] = [createPlayer("a", 1)];
    let t = 100;
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`W${i}`, 10 + i));
      events.push(game(`gW${i}`, t++, "a", `W${i}`));
    }
    for (let i = 0; i < 5; i++) {
      events.push(createPlayer(`L${i}`, 200 + i));
      events.push(game(`gL${i}`, t++, `L${i}`, "a"));
    }
    // After this, A should be roughly back near 1000.

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const summary = tt.achievements.getPlayerProgression("a");
    // The low must have moved down from the initial ~1073, so the
    // diff between current and low is < the initial climb (~73).
    expect(summary.climber.current).toBeLessThan(20);
  });

  it("is only awarded once even if the player drops and climbs again", () => {
    // 30 wins → award. Then A loses many games (drops below) and wins
    // back up. The single award persists.
    const events: EventType[] = [...buildClimb(30)];
    let t = 10_000;
    for (let i = 0; i < 20; i++) {
      events.push(createPlayer(`drop-${i}`, 5000 + i));
      events.push(game(`gd${i}`, t++, `drop-${i}`, "a"));
    }
    for (let i = 0; i < 20; i++) {
      events.push(createPlayer(`climb-${i}`, 6000 + i));
      events.push(game(`gc${i}`, t++, "a", `climb-${i}`));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("a").filter((x) => x.type === "climber")).toHaveLength(1);
  });

  it("progression persists for a deactivated player who earned the achievement", () => {
    const events: EventType[] = [
      ...buildClimb(30),
      {
        time: 50_000,
        stream: "a",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("a");
    expect(progression.climber.earned).toBe(1);
    expect(progression.climber.current).toBeGreaterThanOrEqual(300);
  });
});
