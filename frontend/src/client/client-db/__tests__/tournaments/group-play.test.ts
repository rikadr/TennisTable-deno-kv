import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { GroupScorePlayer, TournamentGroupPlay } from "../../tournaments/group-play";
import { Tournament } from "../../tournaments/tournament";

const TOURNAMENT_ID = "tournament-1";
const START_DATE = 100_000; // Far in the past so the tournament has started

function baseEvents(players: string[], options?: { overridePreferredGroupSize?: number }): EventType[] {
  const events: EventType[] = [];
  let time = 1_000;
  for (const player of players) {
    events.push({ time: time++, stream: player, type: EventTypeEnum.PLAYER_CREATED, data: { name: player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CREATED,
    data: {
      name: "Group play test",
      startDate: START_DATE,
      groupPlay: true,
      overridePreferredGroupSize: options?.overridePreferredGroupSize,
    },
  });
  for (const player of players) {
    events.push({
      time: time++,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SIGNUP,
      data: { player },
    });
  }
  return events;
}

function cancelSignupEvent(player: string, time: number): EventType {
  return {
    time,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_CANCEL_SIGNUP,
    data: { player },
  };
}

let gameTime = 200_000;
function gameEvent(winner: string, loser: string): EventType {
  gameTime += 1;
  return {
    time: gameTime,
    stream: `game-${gameTime}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: gameTime, winner, loser },
  };
}

function skipEvent(winner: string, loser: string): EventType {
  gameTime += 1;
  return {
    time: gameTime,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
    data: { skipId: `skip-${gameTime}`, winner, loser },
  };
}

function getTournament(events: EventType[]): Tournament {
  const tennisTable = new TennisTable({ events });
  const tournament = tennisTable.tournaments.getTournament(TOURNAMENT_ID);
  expect(tournament).toBeDefined();
  return tournament!;
}

function getGroupPlay(events: EventType[]): TournamentGroupPlay {
  const tournament = getTournament(events);
  expect(tournament.groupPlay).toBeDefined();
  return tournament.groupPlay!;
}

function playerNames(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `P${i + 1}`);
}

beforeEach(() => {
  gameTime = 200_000;
});

describe("Group distribution", () => {
  it.each(Array.from({ length: 29 }, (_, i) => i + 2))(
    "keeps group sizes almost equal and assigns every player exactly once (%i signups)",
    (n) => {
      const players = playerNames(n);
      const groupPlay = getGroupPlay(baseEvents(players));

      const sizes = groupPlay.groups.map((group) => group.players.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);

      const assigned = groupPlay.groups.flatMap((group) => group.players);
      expect(assigned).toHaveLength(n);
      expect(new Set(assigned).size).toBe(n);
      expect(assigned.sort()).toEqual([...players].sort());
    },
  );

  it.each([
    [6, [3, 3]],
    [7, [4, 3]],
    [8, [4, 4]],
    [12, [6, 6]],
    [13, [5, 4, 4]],
    [19, [5, 5, 5, 4]],
    [20, [5, 5, 5, 5]],
  ])("splits %i players into groups of %p", (n, expectedSizes) => {
    const groupPlay = getGroupPlay(baseEvents(playerNames(n)));
    const sizes = groupPlay.groups.map((group) => group.players.length).sort((a, b) => b - a);
    expect(sizes).toEqual(expectedSizes);
  });

  it("respects overridePreferredGroupSize", () => {
    const groupPlay = getGroupPlay(baseEvents(playerNames(6), { overridePreferredGroupSize: 2 }));
    const sizes = groupPlay.groups.map((group) => group.players.length);
    expect(sizes).toEqual([2, 2, 2]);
  });

  it("generates a round-robin of games inside each group", () => {
    const groupPlay = getGroupPlay(baseEvents(playerNames(7)));
    for (const group of groupPlay.groups) {
      const k = group.players.length;
      expect(group.groupGames).toHaveLength((k * (k - 1)) / 2);
      expect(group.pending).toHaveLength((k * (k - 1)) / 2);
      expect(group.played).toHaveLength(0);
    }
  });
});

describe("Signup cancellation before start", () => {
  it("excludes a player who cancelled their signup", () => {
    const events = [...baseEvents(playerNames(4)), cancelSignupEvent("P4", 50_000)];
    const groupPlay = getGroupPlay(events);

    const assigned = groupPlay.groups.flatMap((group) => group.players);
    expect(assigned.sort()).toEqual(["P1", "P2", "P3"]);
    expect(groupPlay.playerOrder).not.toContain("P4");
    expect(groupPlay.groupScores.has("P4")).toBe(false);
  });
});

describe("Group scoring", () => {
  // 3 players end up in a single group: games are P1-P2, P1-P3, P2-P3
  const players = ["P1", "P2", "P3"];

  it("awards 3 points for a win and 1 point for a loss", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P1", "P2"),
      gameEvent("P1", "P3"),
      gameEvent("P2", "P3"),
    ];
    const groupPlay = getGroupPlay(events);

    const p1 = groupPlay.groupScores.get("P1")!;
    expect(p1.wins).toBe(2);
    expect(p1.loss).toBe(0);
    expect(p1.score).toBe(6);

    const p2 = groupPlay.groupScores.get("P2")!;
    expect(p2.wins).toBe(1);
    expect(p2.loss).toBe(1);
    expect(p2.score).toBe(4);

    const p3 = groupPlay.groupScores.get("P3")!;
    expect(p3.wins).toBe(0);
    expect(p3.loss).toBe(2);
    expect(p3.score).toBe(2);
  });

  it("awards 0 points and a skip to the loser of a skipped game", () => {
    const events = [
      ...baseEvents(players),
      gameEvent("P1", "P2"),
      gameEvent("P1", "P3"),
      skipEvent("P2", "P3"),
    ];
    const groupPlay = getGroupPlay(events);

    const p2 = groupPlay.groupScores.get("P2")!;
    expect(p2.wins).toBe(1); // A skip still counts as a win for the winner
    expect(p2.score).toBe(3 + 1); // Win over P3 by skip + loss to P1

    const p3 = groupPlay.groupScores.get("P3")!;
    expect(p3.skips).toBe(1);
    expect(p3.loss).toBe(1);
    expect(p3.score).toBe(1); // Only the real loss scores a point
  });

  it("tracks played and pending games as results come in", () => {
    const events = [...baseEvents(players), gameEvent("P1", "P2")];
    const groupPlay = getGroupPlay(events);

    expect(groupPlay.groups[0].played).toHaveLength(1);
    expect(groupPlay.groups[0].pending).toHaveLength(2);
    expect(groupPlay.groups[0].played[0].winner).toBe("P1");
    expect(groupPlay.groupPlayEnded).toBeUndefined();
  });

  it("ends group play at the time of the last completed game", () => {
    const gameEvents = [gameEvent("P1", "P2"), gameEvent("P1", "P3"), gameEvent("P2", "P3")];
    const events = [...baseEvents(players), ...gameEvents];
    const tournament = getTournament(events);
    const groupPlay = tournament.groupPlay!;

    expect(groupPlay.groupPlayEnded).toBe(gameEvents[2].time);
    // Once group play has ended, the bracket is built from the group results
    expect(tournament.bracket).toBeDefined();
  });

  it("compensates smaller groups with a group size adjustment factor", () => {
    // 7 players split into groups of 4 and 3
    const groupPlay = getGroupPlay(baseEvents(playerNames(7)));
    const groupOf4 = groupPlay.groups.find((group) => group.players.length === 4)!;
    const groupOf3 = groupPlay.groups.find((group) => group.players.length === 3)!;

    for (const player of groupOf4.players) {
      expect(groupPlay.groupScores.get(player)!.groupSizeAdjustmentFactor).toBe(1);
    }
    for (const player of groupOf3.players) {
      expect(groupPlay.groupScores.get(player)!.groupSizeAdjustmentFactor).toBe(1.5);
    }
  });
});

describe("Bracket advancement", () => {
  it("floors the bracket size to the biggest full power of 2", () => {
    expect(getGroupPlay(baseEvents(playerNames(3))).getBracketSize()).toBe(2);
    expect(getGroupPlay(baseEvents(playerNames(6))).getBracketSize()).toBe(4);
    expect(getGroupPlay(baseEvents(playerNames(8))).getBracketSize()).toBe(8);
    expect(getGroupPlay(baseEvents(playerNames(9))).getBracketSize()).toBe(8);
  });

  it("advances the best scoring players in order", () => {
    const events = [
      ...baseEvents(["P1", "P2", "P3"]),
      gameEvent("P2", "P1"),
      gameEvent("P2", "P3"),
      gameEvent("P1", "P3"),
    ];
    const groupPlay = getGroupPlay(events);

    // P2 has 2 wins (6), P1 has 1 win + 1 loss (4), P3 has 2 losses (2).
    // Bracket size for 3 players is 2, so P3 is cut
    expect(groupPlay.getBracketPlayerOrder()).toEqual(["P2", "P1"]);
  });
});

describe("TournamentGroupPlay.sortGroupScores", () => {
  function entry(name: string, overrides: Partial<GroupScorePlayer>): [string, GroupScorePlayer] {
    return [
      name,
      {
        name,
        score: 0,
        adjustedScore: 0,
        groupSizeAdjustmentFactor: 1,
        wins: 0,
        loss: 0,
        skips: 0,
        playerOrderIndex: 0,
        ...overrides,
      },
    ];
  }

  function sortNames(entries: [string, GroupScorePlayer][]): string[] {
    return entries.sort(TournamentGroupPlay.sortGroupScores).map(([name]) => name);
  }

  it("sorts by adjusted score first", () => {
    expect(sortNames([entry("A", { adjustedScore: 4 }), entry("B", { adjustedScore: 6 })])).toEqual(["B", "A"]);
  });

  it("breaks adjusted score ties by wins", () => {
    expect(
      sortNames([entry("A", { adjustedScore: 6, wins: 1 }), entry("B", { adjustedScore: 6, wins: 2 })]),
    ).toEqual(["B", "A"]);
  });

  it("breaks wins ties by fewest skips", () => {
    expect(
      sortNames([entry("A", { wins: 2, skips: 2 }), entry("B", { wins: 2, skips: 1 })]),
    ).toEqual(["B", "A"]);
  });

  it("breaks skips ties by raw score, then fewest losses", () => {
    expect(sortNames([entry("A", { score: 4 }), entry("B", { score: 6 })])).toEqual(["B", "A"]);
    expect(sortNames([entry("A", { loss: 2 }), entry("B", { loss: 1 })])).toEqual(["B", "A"]);
  });

  it("defaults to the player order", () => {
    expect(sortNames([entry("A", { playerOrderIndex: 3 }), entry("B", { playerOrderIndex: 1 })])).toEqual(["B", "A"]);
  });
});

describe("simulatePlayerOrder", () => {
  const player1AlwaysWins = (player1: string, player2: string) => ({
    winner: player1,
    loser: player2,
    confidence: 1,
  });

  it("simulates all pending games and returns the resulting player order", () => {
    const groupPlay = getGroupPlay(baseEvents(["P1", "P2", "P3"]));
    const result = groupPlay.simulatePlayerOrder(player1AlwaysWins, 500_000);

    // Round-robin games: P1-P2, P1-P3, P2-P3, player1 always wins
    expect(result.gamesSimulatedCount).toBe(3);
    expect(result.totalConfidenceSum).toBe(3);
    expect(result.playerOrder).toEqual(["P1", "P2"]); // Sliced to bracket size 2
  });

  it("only simulates games that are still pending", () => {
    const events = [...baseEvents(["P1", "P2", "P3"]), gameEvent("P3", "P1")];
    const groupPlay = getGroupPlay(events);
    const result = groupPlay.simulatePlayerOrder(player1AlwaysWins, 500_000);

    expect(result.gamesSimulatedCount).toBe(2);
  });

  it("does not mutate the real group state", () => {
    const groupPlay = getGroupPlay(baseEvents(["P1", "P2", "P3"]));
    groupPlay.simulatePlayerOrder(player1AlwaysWins, 500_000);

    expect(groupPlay.groups[0].pending).toHaveLength(3);
    expect(groupPlay.groups[0].played).toHaveLength(0);
    expect(groupPlay.groups[0].groupGames.every((game) => game.winner === undefined)).toBe(true);
    expect(groupPlay.groupPlayEnded).toBeUndefined();
  });
});
