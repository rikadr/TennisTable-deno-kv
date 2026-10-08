import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";

// Mentor: a player who played their first game against you reaches the top 3
// for the first time. One time for each such player.

describe("Mentor Achievement", () => {
  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  // 5-player double round-robin (20 games). The final standings are A=1,
  // B=2, C=3, D=4, E=5. A plays the first game of every other player, and B
  // plays the first game of A.
  const players = ["a", "b", "c", "d", "e"];
  const pairs: [string, string][] = [
    ["a", "b"],
    ["a", "c"],
    ["a", "d"],
    ["a", "e"],
    ["b", "c"],
    ["b", "d"],
    ["b", "e"],
    ["c", "d"],
    ["c", "e"],
    ["d", "e"],
  ];
  const setup = (playerIds: string[], gamePairs: [string, string][]): EventType[] => {
    const events: EventType[] = playerIds.map((id, index) => ({
      time: index + 1,
      stream: id,
      type: EventTypeEnum.PLAYER_CREATED,
      data: { name: id.toUpperCase() },
    }));
    let t = 100;
    for (let round = 0; round < 2; round++) {
      for (const [winner, loser] of gamePairs) {
        events.push(game(`g-${round}-${winner}-${loser}`, t++, winner, loser));
      }
    }
    return events;
  };

  const mentorAwards = (tt: TennisTable, playerId: string) =>
    tt.achievements.getAchievements(playerId).filter((a) => a.type === "mentor");

  it("awards the first opponent of each player who reaches the top 3", () => {
    const tt = new TennisTable({ events: setup(players, pairs) });
    tt.achievements.calculateAchievements();

    // A was the first opponent of B and C, who reach the podium. D and E never do.
    const a = mentorAwards(tt, "a");
    expect(a.map((award) => award.data.protege).sort()).toEqual(["b", "c"]);
    // B was the first opponent of A.
    const b = mentorAwards(tt, "b");
    expect(b.map((award) => award.data.protege)).toEqual(["a"]);

    expect(mentorAwards(tt, "c")).toHaveLength(0);
    expect(mentorAwards(tt, "d")).toHaveLength(0);
    expect(mentorAwards(tt, "e")).toHaveLength(0);
  });

  it("awards at the same moment as the On the Podium of the protege", () => {
    const tt = new TennisTable({ events: setup(players, pairs) });
    tt.achievements.calculateAchievements();

    for (const protege of ["b", "c"]) {
      const podium = tt.achievements.getAchievements(protege).find((x) => x.type === "on-the-podium")!;
      const mentor = mentorAwards(tt, "a").find((award) => award.data.protege === protege)!;
      expect(mentor.earnedAt).toBe(podium.earnedAt);
      expect(mentor.earnedByGame).toBe(podium.earnedByGame);
      expect(mentor.data.rank).toBeLessThanOrEqual(3);
    }
  });

  it("does not award while fewer than 5 players are ranked", () => {
    const tt = new TennisTable({
      events: setup(
        ["a", "b", "c", "d"],
        pairs.filter(([winner, loser]) => winner !== "e" && loser !== "e"),
      ),
    });
    tt.achievements.calculateAchievements();

    for (const id of ["a", "b", "c", "d"]) expect(mentorAwards(tt, id)).toHaveLength(0);
  });

  it("measures the progress from the highest protege without a Mentor", () => {
    const tt = new TennisTable({ events: setup(players, pairs) });
    tt.achievements.calculateAchievements();

    // A has a Mentor for B and C. D is at rank 4 of 5: last place is 0 and
    // 3rd place is the target, so D is half the way.
    const progression = tt.achievements.getPlayerProgression("a").mentor;
    expect(progression.closestProtege).toBe("d");
    expect(progression.closestProtegeRank).toBe(4);
    expect(progression.current).toBe(1);
    expect(progression.target).toBe(2);
    expect(progression.earned).toBe(2);
  });

  it("shows no progress for a player who was not a first opponent", () => {
    const tt = new TennisTable({ events: setup(players, pairs) });
    tt.achievements.calculateAchievements();

    const progression = tt.achievements.getPlayerProgression("e").mentor;
    expect(progression.closestProtege).toBeUndefined();
    expect(progression.current).toBe(0);
  });
});
