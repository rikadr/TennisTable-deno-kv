import { ONE_DAY } from "../../../../common/time-in-ms";
import { EventType, EventTypeEnum } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import { Tournament } from "../../tournaments/tournament";
import { buildTournamentTimeline, TimelineSection } from "../../tournaments/tournament-timeline";

const TOURNAMENT_ID = "tournament-1";
const START = 10 * ONE_DAY; // Far in the past so the tournament has started

/** Timestamps are expressed as whole days after the tournament start, which keeps them readable */
const day = (days: number) => START + days * ONE_DAY;

type Options = { groupPlay?: boolean; doubleElimination?: boolean; overridePreferredGroupSize?: number };

function baseEvents(players: string[], options?: Options): EventType[] {
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
      name: "Timeline test",
      startDate: START,
      groupPlay: options?.groupPlay ?? false,
      doubleElimination: options?.doubleElimination ?? false,
      overridePreferredGroupSize: options?.overridePreferredGroupSize,
    },
  });
  for (const player of players) {
    events.push({ time: time++, stream: TOURNAMENT_ID, type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player } });
  }
  events.push({
    time: time++,
    stream: TOURNAMENT_ID,
    type: EventTypeEnum.TOURNAMENT_SET_PLAYER_ORDER,
    data: { playerOrder: players },
  });
  return events;
}

function gameEvent(winner: string, loser: string, playedAt: number): EventType {
  return {
    time: playedAt,
    stream: `game-${winner}-${loser}-${playedAt}`,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt, winner, loser },
  };
}

function getTournament(events: EventType[]): Tournament {
  const tournament = new TennisTable({ events }).tournaments.getTournament(TOURNAMENT_ID);
  expect(tournament).toBeDefined();
  return tournament!;
}

function section(sections: TimelineSection[], key: string): TimelineSection {
  const found = sections.find((s) => s.key === key);
  expect(found).toBeDefined();
  return found!;
}

/** Compact view of a segment as whole days from the tournament start, for readable assertions */
function span(segment: { start: number; lastGameAt?: number }): [number, number | undefined] {
  return [(segment.start - START) / ONE_DAY, segment.lastGameAt && (segment.lastGameAt - START) / ONE_DAY];
}

describe("Tournament timeline", () => {
  it("returns undefined for a tournament that has not started", () => {
    const events = baseEvents(["P1", "P2"]);
    // Move the start date into the future
    events.push({
      time: 100_000,
      stream: TOURNAMENT_ID,
      type: EventTypeEnum.TOURNAMENT_UPDATED,
      data: { startDate: Date.now() + 10 * ONE_DAY },
    });
    expect(buildTournamentTimeline(getTournament(events))).toBeUndefined();
  });

  it("times each bracket round from when the previous round finished", () => {
    // 4 players, no group play. Semifinals are P1 vs P4 and P2 vs P3
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"]),
        gameEvent("P1", "P4", day(1)),
        gameEvent("P2", "P3", day(3)),
        gameEvent("P1", "P2", day(4)),
      ]),
    )!;

    expect(timeline.sections.map((s) => s.key)).toEqual(["winners"]);
    expect(span(timeline)).toEqual([0, 4]);
    expect(timeline.completed).toBe(true);
    expect(timeline.gamesPlayed).toBe(3);
    expect(timeline.gamesTotal).toBe(3);

    const bracket = section(timeline.sections, "winners");
    expect(span(bracket)).toEqual([0, 4]);
    // Semifinals first (deepest layer), then the final
    expect(bracket.subSections.map((sub) => sub.ref)).toEqual([
      { kind: "winners-layer", layerIndex: 1 },
      { kind: "winners-layer", layerIndex: 0 },
    ]);
    // The semifinals own the wait from the tournament start until the second one was played
    expect(span(bracket.subSections[0])).toEqual([0, 3]);
    // The final's clock starts when the semifinals finished, not when the tournament started
    expect(span(bracket.subSections[1])).toEqual([3, 4]);
  });

  it("runs group play groups in parallel from the tournament start", () => {
    // Two groups of two, so each group is a single game and all four players advance
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"], { groupPlay: true, overridePreferredGroupSize: 2 }),
        gameEvent("P1", "P4", day(1)), // Group 1
        gameEvent("P2", "P3", day(2)), // Group 2
        gameEvent("P1", "P4", day(3)), // Semifinal
        gameEvent("P2", "P3", day(4)), // Semifinal
        gameEvent("P1", "P2", day(5)), // Final
      ]),
    )!;

    expect(timeline.sections.map((s) => s.key)).toEqual(["group-play", "winners"]);
    expect(span(timeline)).toEqual([0, 5]);
    expect(timeline.completed).toBe(true);

    const groupPlay = section(timeline.sections, "group-play");
    expect(groupPlay.parallelSubSections).toBe(true);
    expect(span(groupPlay)).toEqual([0, 2]);
    // Both groups start at the tournament start and end at their own last game
    expect(span(groupPlay.subSections[0])).toEqual([0, 1]);
    expect(span(groupPlay.subSections[1])).toEqual([0, 2]);

    // The bracket takes over when group play ended
    const bracket = section(timeline.sections, "winners");
    expect(span(bracket)).toEqual([2, 5]);
    expect(span(bracket.subSections[0])).toEqual([2, 4]); // Semifinals
    expect(span(bracket.subSections[1])).toEqual([4, 5]); // Final
  });

  it("splits a double elimination tournament into winners, losers and grand final", () => {
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: true }),
        gameEvent("P1", "P4", day(1)), // Winners semifinal
        gameEvent("P2", "P3", day(2)), // Winners semifinal
        gameEvent("P4", "P3", day(3)), // Losers round 1
        gameEvent("P1", "P2", day(4)), // Winners final
        gameEvent("P2", "P4", day(5)), // Losers final
        gameEvent("P2", "P1", day(6)), // Grand final won by the losers bracket champion
        gameEvent("P1", "P2", day(7)), // Bracket reset
      ]),
    )!;

    expect(timeline.sections.map((s) => s.key)).toEqual(["winners", "losers", "grand-final"]);
    expect(span(timeline)).toEqual([0, 7]);
    expect(timeline.completed).toBe(true);
    expect(timeline.gamesPlayed).toBe(7);
    expect(timeline.gamesTotal).toBe(7);

    expect(span(section(timeline.sections, "winners"))).toEqual([0, 4]);

    // Losers round 1 can only start once the winners semifinals produced its two players
    const losers = section(timeline.sections, "losers");
    expect(span(losers)).toEqual([2, 5]);
    expect(span(losers.subSections[0])).toEqual([2, 3]); // Losers round 1
    // The losers final waits for the winners final loser, not just for the previous losers round
    expect(span(losers.subSections[1])).toEqual([4, 5]);

    // The grand final waits for both bracket champions, and the reset follows it
    const grandFinal = section(timeline.sections, "grand-final");
    expect(span(grandFinal)).toEqual([5, 7]);
    expect(grandFinal.subSections.map((sub) => sub.ref)).toEqual([{ kind: "grand-final-game" }, { kind: "bracket-reset" }]);
    expect(span(grandFinal.subSections[0])).toEqual([5, 6]);
    expect(span(grandFinal.subSections[1])).toEqual([6, 7]);
  });

  it("leaves out the bracket reset when the winners bracket champion holds on", () => {
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: true }),
        gameEvent("P1", "P4", day(1)),
        gameEvent("P2", "P3", day(2)),
        gameEvent("P4", "P3", day(3)),
        gameEvent("P1", "P2", day(4)),
        gameEvent("P2", "P4", day(5)),
        gameEvent("P1", "P2", day(6)), // Grand final won by the winners bracket champion
      ]),
    )!;

    const grandFinal = section(timeline.sections, "grand-final");
    expect(grandFinal.subSections.map((sub) => sub.ref)).toEqual([{ kind: "grand-final-game" }]);
    expect(timeline.gamesTotal).toBe(6);
    expect(timeline.completed).toBe(true);
  });

  it("marks the rounds still being played as not completed", () => {
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"]),
        gameEvent("P1", "P4", day(1)), // Only one of the two semifinals is played
      ]),
    )!;

    const bracket = section(timeline.sections, "winners");
    expect(timeline.completed).toBe(false);
    expect(timeline.gamesPlayed).toBe(1);
    expect(timeline.gamesTotal).toBe(3);

    const semiFinals = bracket.subSections[0];
    expect(semiFinals.completed).toBe(false);
    expect(semiFinals.started).toBe(true);
    expect(span(semiFinals)).toEqual([0, 1]);

    // The final has not been reachable yet, so it has no games and falls back to the last known boundary
    const final = bracket.subSections[1];
    expect(final.completed).toBe(false);
    expect(final.started).toBe(false);
    expect(final.gamesPlayed).toBe(0);
    expect(final.lastGameAt).toBeUndefined();
    expect(span(final)).toEqual([0, undefined]);
  });

  it("starts a round's clock when the round before it finishes, even before its first game", () => {
    // Both semifinals are played, so the final is playable but has no games yet
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"]),
        gameEvent("P1", "P4", day(1)),
        gameEvent("P2", "P3", day(2)),
      ]),
    )!;

    const bracket = section(timeline.sections, "winners");
    const final = bracket.subSections[1];
    expect(final.started).toBe(true);
    expect(final.completed).toBe(false);
    expect(final.gamesPlayed).toBe(0);
    // Its clock has been running since the semifinals handed over
    expect(span(final)).toEqual([2, undefined]);
  });

  it("keeps a losers round off the clock until both its feeders are done", () => {
    // Winners bracket fully played, losers round 1 played: the losers final is playable but has no
    // games, and the grand final is still blocked on the losers bracket champion
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3", "P4"], { doubleElimination: true }),
        gameEvent("P1", "P4", day(1)), // Winners semifinal
        gameEvent("P2", "P3", day(2)), // Winners semifinal
        gameEvent("P4", "P3", day(3)), // Losers round 1
        gameEvent("P1", "P2", day(4)), // Winners final
      ]),
    )!;

    const losers = section(timeline.sections, "losers");
    const losersFinal = losers.subSections[1];
    expect(losersFinal.started).toBe(true);
    expect(losersFinal.gamesPlayed).toBe(0);
    // The losers final waits for the winners final loser, so its clock starts at day 4
    expect(span(losersFinal)).toEqual([4, undefined]);

    // The grand final has no losers bracket champion yet
    const grandFinal = section(timeline.sections, "grand-final");
    expect(grandFinal.started).toBe(false);
    expect(grandFinal.subSections[0].started).toBe(false);
  });

  it("skips losers bracket rounds that only hold walkovers", () => {
    // 3 players: only one winners first round game is played, so losers round 1 is a walkover
    const timeline = buildTournamentTimeline(
      getTournament([
        ...baseEvents(["P1", "P2", "P3"], { doubleElimination: true }),
        gameEvent("P2", "P3", day(1)), // Winners first round
        gameEvent("P1", "P2", day(2)), // Winners final
        gameEvent("P3", "P2", day(3)), // Losers final: P3 took the walkover, P2 dropped down
        gameEvent("P1", "P3", day(4)), // Grand final
      ]),
    )!;

    const losers = section(timeline.sections, "losers");
    // Only the losers final is a real game. Round 1 is a walkover and never shows up
    expect(losers.subSections.map((sub) => sub.ref)).toEqual([{ kind: "losers-layer", layerIndex: 0, totalLayers: 2 }]);
    expect(span(losers)).toEqual([2, 3]);
    expect(timeline.completed).toBe(true);
    expect(timeline.gamesTotal).toBe(4);
  });
});
