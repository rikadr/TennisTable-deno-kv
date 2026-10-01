import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { GameTag } from "../game-tags";

let time = 1_000;
let gameTime = 200_000;

beforeEach(() => {
  time = 1_000;
  gameTime = 200_000;
});

function playerEvents(players: string[]): EventType[] {
  return players.map((player) => ({
    time: time++,
    stream: player,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: player },
  }));
}

/** A game. Returns its events, its id and the time it was played */
function game(winner: string, loser: string): { events: EventType[]; id: string; playedAt: number } {
  gameTime += 10;
  const playedAt = gameTime;
  const id = `game-${playedAt}`;
  return {
    events: [{ time: playedAt, stream: id, type: EventTypeEnum.GAME_CREATED, data: { playedAt, winner, loser } }],
    id,
    playedAt,
  };
}

function tagsOf(events: EventType[], gameId: string): GameTag[] {
  const tt = new TennisTable({ events });
  const target = tt.games.find((g) => g.id === gameId);
  if (!target) throw new Error(`No game ${gameId}`);
  return tt.gameTags.getTags(target);
}

const types = (tags: GameTag[]) => tags.filter((tag) => tag.type !== "achievement").map((tag) => tag.type);

describe("Game tags", () => {
  it("tags the first game of a pair as the first meeting, in both player orders", () => {
    const first = game("A", "B");
    const second = game("B", "A");
    const events = [...playerEvents(["A", "B"]), ...first.events, ...second.events];

    expect(types(tagsOf(events, first.id))).toContain("first-meeting");
    expect(types(tagsOf(events, second.id))).not.toContain("first-meeting");
  });

  it("tags the achievements the game earned", () => {
    const first = game("A", "B");
    const events = [...playerEvents(["A", "B"]), ...first.events];

    const earned = tagsOf(events, first.id).flatMap((tag) => (tag.type === "achievement" ? [tag.achievement] : []));
    expect(
      earned
        .filter((a) => a.type === "first-game")
        .map((a) => a.earnedBy)
        .sort(),
    ).toEqual(["A", "B"]);
  });

  it("tags a tournament game with its placement", () => {
    const players = ["P1", "P2"];
    const tournamentId = "tournament-1";
    const events: EventType[] = [
      ...playerEvents(players),
      {
        time: time++,
        stream: tournamentId,
        type: EventTypeEnum.TOURNAMENT_CREATED,
        data: { name: "Cup", startDate: 100_000, groupPlay: false },
      },
      ...players.map((player) => ({
        time: time++,
        stream: tournamentId,
        type: EventTypeEnum.TOURNAMENT_SIGNUP as const,
        data: { player },
      })),
      {
        time: time++,
        stream: tournamentId,
        type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
        data: { playerOrder: players },
      },
    ];
    const final = game("P1", "P2");

    const tournamentTags = tagsOf([...events, ...final.events], final.id).filter((tag) => tag.type === "tournament");
    expect(tournamentTags).toHaveLength(1);
    expect(tournamentTags[0].type === "tournament" && tournamentTags[0].placement.tournament.name).toBe("Cup");
  });

  it("lists the tags in display order", () => {
    const first = game("A", "B");
    const events = [...playerEvents(["A", "B"]), ...first.events];

    const tags = tagsOf(events, first.id);
    expect(tags[0].type).toBe("first-meeting");
    expect(tags.length).toBeGreaterThan(1);
    expect(tags.slice(1).every((tag) => tag.type === "achievement")).toBe(true);
  });
});
