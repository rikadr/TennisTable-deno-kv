import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TournamentGamePlacement } from "../../tournaments/tournament";

const TOURNAMENT_ID = "tournament-1";
const SECOND_TOURNAMENT_ID = "tournament-2";
const START_DATE = 100_000; // Far in the past so the tournaments have started

type TournamentOptions = {
  id?: string;
  name?: string;
  groupPlay?: boolean;
  doubleElimination?: boolean;
  overridePreferredGroupSize?: number;
};

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

function tournamentEvents(players: string[], options?: TournamentOptions): EventType[] {
  const id = options?.id ?? TOURNAMENT_ID;
  const events: EventType[] = [
    {
      time: time++,
      stream: id,
      type: EventTypeEnum.TOURNAMENT_CREATED,
      data: {
        name: options?.name ?? "Placement test",
        startDate: START_DATE,
        groupPlay: options?.groupPlay ?? false,
        doubleElimination: options?.doubleElimination ?? false,
        overridePreferredGroupSize: options?.overridePreferredGroupSize,
      },
    },
  ];
  for (const player of players) {
    events.push({ time: time++, stream: id, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } });
  }
  events.push({
    time: time++,
    stream: id,
    type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
    data: { playerOrder: players },
  });
  return events;
}

/** A played game together with the time it identifies itself by on the game details page */
function game(winner: string, loser: string): { event: EventType; playedAt: number } {
  gameTime += 1;
  const playedAt = gameTime;
  return {
    event: {
      time: playedAt,
      stream: `game-${playedAt}`,
      type: EventTypeEnum.GAME_CREATED,
      data: { playedAt, winner, loser },
    },
    playedAt,
  };
}

function skip(winner: string, loser: string): { event: EventType; time: number } {
  gameTime += 1;
  const skippedAt = gameTime;
  return {
    event: {
      time: skippedAt,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_SKIP_GAME,
      data: { skipId: `skip-${skippedAt}`, winner, loser },
    },
    time: skippedAt,
  };
}

function placementsOf(events: EventType[], playedAt: number): TournamentGamePlacement[] {
  return new TennisTable({ events }).tournaments.findGamePlacements(playedAt);
}

describe("Placing a game in a tournament", () => {
  const players = ["P1", "P2", "P3", "P4"]; // Seeding: the first round is P1 vs P4 and P2 vs P3

  it("names the bracket layer of a single elimination game", () => {
    const semiFinal = game("P1", "P4");
    const otherSemiFinal = game("P2", "P3");
    const final = game("P1", "P2");
    const events = [
      ...playerEvents(players),
      ...tournamentEvents(players),
      semiFinal.event,
      otherSemiFinal.event,
      final.event,
    ];

    expect(placementsOf(events, semiFinal.playedAt)).toEqual([
      {
        tournament: { id: TOURNAMENT_ID, name: "Placement test" },
        player1: "P1",
        player2: "P4",
        where: "bracket",
        section: "winners",
        layerIndex: 1,
        layerCount: 2,
        doubleElimination: false,
      },
    ]);
    expect(placementsOf(events, final.playedAt)).toEqual([
      {
        tournament: { id: TOURNAMENT_ID, name: "Placement test" },
        player1: "P1",
        player2: "P2",
        where: "bracket",
        section: "winners",
        layerIndex: 0,
        layerCount: 2,
        doubleElimination: false,
      },
    ]);
  });

  it("names the section of every double elimination game", () => {
    const firstChanceSemiFinal = game("P1", "P4");
    const otherFirstChanceSemiFinal = game("P2", "P3");
    const secondChanceRound1 = game("P4", "P3");
    const firstChanceFinal = game("P1", "P2");
    const secondChanceFinal = game("P2", "P4");
    const grandFinal = game("P2", "P1"); // The second chance champion wins, so the decider is played
    const bracketReset = game("P2", "P1");
    const events = [
      ...playerEvents(players),
      ...tournamentEvents(players, { doubleElimination: true }),
      firstChanceSemiFinal.event,
      otherFirstChanceSemiFinal.event,
      secondChanceRound1.event,
      firstChanceFinal.event,
      secondChanceFinal.event,
      grandFinal.event,
      bracketReset.event,
    ];

    const sectionOf = (playedAt: number) => {
      const placement = placementsOf(events, playedAt)[0];
      expect(placement.where).toBe("bracket");
      if (placement.where !== "bracket") throw new Error("Expected a bracket placement");
      return { section: placement.section, layerIndex: placement.layerIndex, layerCount: placement.layerCount };
    };

    expect(sectionOf(firstChanceSemiFinal.playedAt)).toEqual({ section: "winners", layerIndex: 1, layerCount: 2 });
    expect(sectionOf(firstChanceFinal.playedAt)).toEqual({ section: "winners", layerIndex: 0, layerCount: 2 });
    expect(sectionOf(secondChanceRound1.playedAt)).toEqual({ section: "losers", layerIndex: 1, layerCount: 2 });
    expect(sectionOf(secondChanceFinal.playedAt)).toEqual({ section: "losers", layerIndex: 0, layerCount: 2 });
    expect(sectionOf(grandFinal.playedAt)).toEqual({ section: "grandFinal", layerIndex: 0, layerCount: 1 });
    expect(sectionOf(bracketReset.playedAt)).toEqual({ section: "bracketReset", layerIndex: 0, layerCount: 1 });
  });

  it("names the group of a group play game", () => {
    const groupPlayers = ["P1", "P2", "P3", "P4", "P5", "P6"];
    const groupGame = game("P1", "P6");
    const events = [
      ...playerEvents(groupPlayers),
      ...tournamentEvents(groupPlayers, { groupPlay: true, overridePreferredGroupSize: 3 }),
      groupGame.event,
    ];

    const state = new TennisTable({ events });
    const tournament = state.tournaments.getTournament(TOURNAMENT_ID)!;
    const expectedGroupIndex = tournament.groupPlay!.groups.findIndex(
      (group) => group.players.includes("P1") && group.players.includes("P6"),
    );
    expect(expectedGroupIndex).toBeGreaterThanOrEqual(0);

    const placement = state.tournaments.findGamePlacements(groupGame.playedAt)[0];
    expect(placement.where).toBe("group");
    if (placement.where !== "group") throw new Error("Expected a group placement");
    expect(placement.groupIndex).toBe(expectedGroupIndex);
    expect([placement.player1, placement.player2].sort()).toEqual(["P1", "P6"]);
  });

  it("places the same game in every tournament that holds it", () => {
    const semiFinal = game("P1", "P4");
    const events = [
      ...playerEvents(players),
      ...tournamentEvents(players, { name: "First cup" }),
      ...tournamentEvents(players, { id: SECOND_TOURNAMENT_ID, name: "Second cup" }),
      semiFinal.event,
    ];

    const placements = placementsOf(events, semiFinal.playedAt);
    expect(placements.map((placement) => placement.tournament)).toEqual([
      { id: TOURNAMENT_ID, name: "First cup" },
      { id: SECOND_TOURNAMENT_ID, name: "Second cup" },
    ]);
  });

  it("places no game that the tournament does not hold", () => {
    const outsideGame = game("P5", "P6");
    const events = [...playerEvents([...players, "P5", "P6"]), ...tournamentEvents(players), outsideGame.event];

    expect(placementsOf(events, outsideGame.playedAt)).toEqual([]);
  });

  it("places no skipped game: nobody played it", () => {
    const semiFinal = game("P1", "P4");
    const skipped = skip("P2", "P3");
    const events = [...playerEvents(players), ...tournamentEvents(players), semiFinal.event, skipped.event];

    expect(placementsOf(events, skipped.time)).toEqual([]);
    expect(placementsOf(events, semiFinal.playedAt)).toHaveLength(1);
  });
});
