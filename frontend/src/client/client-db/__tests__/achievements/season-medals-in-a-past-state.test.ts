import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { determineSeason } from "../../seasons/seasons";

// The season medals read the final leaderboard of a season, so they exist only
// after the season has ended. The rule used to compare against the real clock,
// so a state projected at a moment inside a running season treated that season
// as finished and gave the medal to whoever led at that moment. The medal then
// moved to another player, or vanished, as the lead changed — a Hall of Fame
// score that fell over time for an award nobody had actually won yet.
describe("Season medals in a state projected at a past moment", () => {
  const season = determineSeason(new Date(2024, 1, 15, 12).getTime());
  const early = season.start + 24 * 60 * 60 * 1000;
  const late = season.end - 24 * 60 * 60 * 1000;

  const game = (id: string, playedAt: number, winner: string, loser: string): EventType => ({
    type: EventTypeEnum.GAME_CREATED,
    stream: id,
    time: playedAt,
    data: { winner, loser, playedAt },
  });

  // Alice leads early. Bob wins every later game and ends the season on top.
  const events: EventType[] = [
    { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
    { type: EventTypeEnum.PLAYER_CREATED, stream: "carol", time: 3, data: { name: "Carol" } },
    game("g1", early, "alice", "carol"),
    game("g2", early + 1000, "alice", "carol"),
    game("g3", late, "bob", "carol"),
    game("g4", late + 1000, "bob", "carol"),
    game("g5", late + 2000, "bob", "alice"),
    game("g6", late + 3000, "bob", "alice"),
  ];

  const medalsAt = (referenceTime: number) => {
    const upTo = events.filter((event) =>
      event.type === EventTypeEnum.GAME_CREATED ? event.data.playedAt <= referenceTime : event.time <= referenceTime,
    );
    const tennisTable = new TennisTable({ events: upTo, referenceTime });
    tennisTable.achievements.calculateAchievements();
    return ["alice", "bob", "carol"].flatMap((playerId) =>
      (tennisTable.achievements.achievementMap.get(playerId) ?? [])
        .filter((a) => a.type === "season-winner" || a.type === "so-close")
        .map((a) => `${playerId}:${a.type}`),
    );
  };

  it("gives no season medal while the season is still running", () => {
    expect(medalsAt(early + 2000)).toEqual([]);
    expect(medalsAt(late + 3000)).toEqual([]);
  });

  it("gives the medal to the player who led at the end of the season", () => {
    const medals = medalsAt(season.end + 1000);
    expect(medals).toContain("bob:season-winner");
    expect(medals).not.toContain("alice:season-winner");
  });

  it("keeps the medal once the season has ended", () => {
    const atEnd = medalsAt(season.end + 1000);
    const muchLater = medalsAt(season.end + 400 * 24 * 60 * 60 * 1000);
    expect(muchLater).toEqual(atEnd);
  });
});
