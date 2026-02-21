import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TournamentDB } from "../../types";

describe("Tournament Participated (Competitor) Achievement", () => {
  let baseEvents: EventType[];

  beforeEach(() => {
    baseEvents = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 2000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Bob" },
      },
      {
        time: 3000,
        stream: "player-3",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Charlie" },
      },
      {
        time: 4000,
        stream: "player-4",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "David" },
      },
    ];
  });

  it("should NOT award competitor achievement for a tournament that has not started yet", () => {
    const futureStartDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // 1 week in the future

    const tournament: TournamentDB = {
      id: "tournament-1",
      name: "Future Tournament",
      startDate: futureStartDate,
      groupPlay: false,
      playerOrder: ["player-1", "player-2", "player-3", "player-4"],
    };

    const tennisTable = new TennisTable({ events: baseEvents });
    tennisTable.client.tournaments = [tournament];

    tennisTable.achievements.calculateAchievements();

    const player1Achievements = tennisTable.achievements.getAchievements("player-1");
    const participated = player1Achievements.filter((a) => a.type === "tournament-participated");

    expect(participated).toHaveLength(0);
  });

  it("should award competitor achievement for a tournament that has already started", () => {
    const pastStartDate = Date.now() - 7 * 24 * 60 * 60 * 1000; // 1 week in the past

    const tournament: TournamentDB = {
      id: "tournament-1",
      name: "Past Tournament",
      startDate: pastStartDate,
      groupPlay: false,
      playerOrder: ["player-1", "player-2", "player-3", "player-4"],
    };

    const tennisTable = new TennisTable({ events: baseEvents });
    tennisTable.client.tournaments = [tournament];

    tennisTable.achievements.calculateAchievements();

    const player1Achievements = tennisTable.achievements.getAchievements("player-1");
    const participated = player1Achievements.filter((a) => a.type === "tournament-participated");

    expect(participated).toHaveLength(1);
    expect(participated[0].earnedAt).toBe(pastStartDate);
    expect(participated[0].earnedAt).toBeLessThanOrEqual(Date.now());
  });

  it("should not produce a future earnedAt timestamp", () => {
    const futureStartDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days in the future

    const tournament: TournamentDB = {
      id: "tournament-future",
      name: "Far Future Tournament",
      startDate: futureStartDate,
      groupPlay: false,
      playerOrder: ["player-1", "player-2"],
    };

    const tennisTable = new TennisTable({ events: baseEvents });
    tennisTable.client.tournaments = [tournament];

    tennisTable.achievements.calculateAchievements();

    // No achievements should have a future earnedAt
    const allPlayer1Achievements = tennisTable.achievements.getAchievements("player-1");
    const futureAchievements = allPlayer1Achievements.filter((a) => a.earnedAt > Date.now());

    expect(futureAchievements).toHaveLength(0);
  });

  it("should award competitor achievement only for started tournaments when both past and future exist", () => {
    const pastStartDate = Date.now() - 14 * 24 * 60 * 60 * 1000; // 2 weeks ago
    const futureStartDate = Date.now() + 14 * 24 * 60 * 60 * 1000; // 2 weeks from now

    const pastTournament: TournamentDB = {
      id: "tournament-past",
      name: "Past Tournament",
      startDate: pastStartDate,
      groupPlay: false,
      playerOrder: ["player-1", "player-2", "player-3", "player-4"],
    };

    const futureTournament: TournamentDB = {
      id: "tournament-future",
      name: "Future Tournament",
      startDate: futureStartDate,
      groupPlay: false,
      playerOrder: ["player-1", "player-2", "player-3", "player-4"],
    };

    const tennisTable = new TennisTable({ events: baseEvents });
    tennisTable.client.tournaments = [pastTournament, futureTournament];

    tennisTable.achievements.calculateAchievements();

    const player1Achievements = tennisTable.achievements.getAchievements("player-1");
    const participated = player1Achievements.filter((a) => a.type === "tournament-participated");

    // Should only get 1 (from the past tournament), not 2
    expect(participated).toHaveLength(1);
    expect(participated[0].data.tournamentId).toBe("tournament-past");
  });
});
