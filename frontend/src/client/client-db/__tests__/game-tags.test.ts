import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";
import { GameTag, UPSET_ELO_GAP } from "../game-tags";

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

/** A game, and a score when set points are given. Returns the events and the game id */
function game(
  winner: string,
  loser: string,
  setPoints?: { gameWinner: number; gameLoser: number }[],
): { events: EventType[]; id: string; playedAt: number } {
  gameTime += 10;
  const playedAt = gameTime;
  const id = `game-${playedAt}`;
  const events: EventType[] = [
    { time: playedAt, stream: id, type: EventTypeEnum.GAME_CREATED, data: { playedAt, winner, loser } },
  ];
  if (setPoints) {
    const won = setPoints.filter((set) => set.gameWinner > set.gameLoser).length;
    events.push({
      time: playedAt + 1,
      stream: id,
      type: EventTypeEnum.GAME_SCORE,
      data: { setsWon: { gameWinner: won, gameLoser: setPoints.length - won }, setPoints },
    });
  }
  return { events, id, playedAt };
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

  it("tags a comeback when the winner lost the first set", () => {
    const comeback = game("A", "B", [
      { gameWinner: 8, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 11, gameLoser: 7 },
    ]);
    const straight = game("A", "B", [
      { gameWinner: 11, gameLoser: 9 },
      { gameWinner: 9, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 7 },
    ]);
    const noScore = game("A", "B");
    const events = [...playerEvents(["A", "B"]), ...comeback.events, ...straight.events, ...noScore.events];

    expect(types(tagsOf(events, comeback.id))).toContain("comeback");
    expect(types(tagsOf(events, straight.id))).not.toContain("comeback");
    expect(types(tagsOf(events, noScore.id))).not.toContain("comeback");
  });

  it("tags an upset when the winner had at least UPSET_ELO_GAP less Elo before the game", () => {
    const players = playerEvents(["A", "B"]);
    const favouriteWins = Array.from({ length: 12 }, () => game("A", "B"));
    const favouriteWinsAgain = game("A", "B");
    const upset = game("B", "A");
    const events = [
      ...players,
      ...favouriteWins.flatMap((g) => g.events),
      ...favouriteWinsAgain.events,
      ...upset.events,
    ];

    const upsetTag = tagsOf(events, upset.id).find((tag) => tag.type === "upset");
    expect(upsetTag).toBeDefined();
    expect(upsetTag?.type === "upset" && upsetTag.eloGap).toBeGreaterThanOrEqual(UPSET_ELO_GAP);
    expect(types(tagsOf(events, favouriteWinsAgain.id))).not.toContain("upset");
  });

  it("does not tag an upset when the Elo gap is below UPSET_ELO_GAP", () => {
    const first = game("A", "B");
    const second = game("B", "A");
    const events = [...playerEvents(["A", "B"]), ...first.events, ...second.events];

    expect(types(tagsOf(events, second.id))).not.toContain("upset");
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
    const first = game("A", "B", [
      { gameWinner: 5, gameLoser: 11 },
      { gameWinner: 11, gameLoser: 5 },
      { gameWinner: 11, gameLoser: 5 },
    ]);
    const events = [...playerEvents(["A", "B"]), ...first.events];

    const tags = tagsOf(events, first.id);
    expect(tags.map((tag) => tag.type).slice(0, 2)).toEqual(["first-meeting", "comeback"]);
    expect(tags.slice(2).every((tag) => tag.type === "achievement")).toBe(true);
  });
});
