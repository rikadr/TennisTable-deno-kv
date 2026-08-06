import { TournamentBracket } from "./bracket";
import { Tournament, TournamentGame, TournamentGameTarget } from "./tournament";

/**
 * How long each part of a tournament took, laid out as a sequence of segments that can be drawn as
 * a Gantt style timeline.
 *
 * A segment starts the moment its first game became available to play - the moment that game's
 * last participant became known - and ends the moment its last game is played. Waiting for players
 * to show up is part of how long a round takes, so a round with a game available but not yet
 * played is on the clock (`started`) even with nothing on the record. A round none of whose games
 * have been reachable yet is not. Group play is the simplest case: all groups run in parallel from
 * the tournament start.
 *
 * Segments that still have games left to play report `completed: false` and the consumer decides
 * what to draw them up against (usually "now").
 */

export type TimelineRef =
  | { kind: "group"; groupIndex: number }
  | { kind: "winners-layer"; layerIndex: number }
  | { kind: "losers-layer"; layerIndex: number; totalLayers: number }
  | { kind: "grand-final-game" }
  | { kind: "bracket-reset" };

export type TimelineSectionKind = "group-play" | "winners" | "losers" | "grand-final";

type TimelineSegment = {
  /** Stable identity, used as the react key */
  key: string;
  /** When the segment's first game became available to play */
  start: number;
  /**
   * The segment's clock is running: at least one of its games is (or was) available to play.
   * False while every game is still waiting on earlier rounds - `start` is a fallback then
   */
  started: boolean;
  /** Completion time of the last game played in it. Undefined until a game has been completed */
  lastGameAt?: number;
  /** Every game in the segment has been completed */
  completed: boolean;
  gamesPlayed: number;
  gamesTotal: number;
};

export type TimelineSubSection = TimelineSegment & { ref: TimelineRef };

export type TimelineSection = TimelineSegment & {
  kind: TimelineSectionKind;
  /** Group play runs its groups side by side. Bracket rounds follow each other */
  parallelSubSections: boolean;
  subSections: TimelineSubSection[];
};

export type TournamentTimeline = TimelineSegment & { sections: TimelineSection[] };

/** Games that are structurally never played: empty byes and walkovers (a lone player, no game) */
function isPlayableGame(game: Partial<TournamentGame>): boolean {
  return game.isBye !== true && game.walkover !== true;
}

function completionTimes(games: Partial<TournamentGame>[]): number[] {
  return games.map((game) => game.completedAt).filter((time): time is number => time !== undefined);
}

/**
 * A segment's clock starts at the earliest time one of its games was available - or at its
 * earliest played game, if one was somehow completed before that, so the segment never starts
 * after its own first game
 */
function segment(
  key: string,
  fallbackStart: number,
  availableTimes: number[],
  times: number[],
  gamesTotal: number,
): TimelineSegment {
  const clockTimes = [...availableTimes, ...times];
  const gamesPlayed = times.length;
  return {
    key,
    start: clockTimes.length > 0 ? Math.min(...clockTimes) : fallbackStart,
    started: clockTimes.length > 0,
    lastGameAt: gamesPlayed > 0 ? Math.max(...times) : undefined,
    completed: gamesPlayed >= gamesTotal,
    gamesPlayed,
    gamesTotal,
  };
}

/**
 * Roll a list of sub sections up into the totals of the section holding them. A section starts
 * where its first started sub section starts, which for the losers bracket is later than the
 * bracket itself: it can only get going once the first winners round has produced someone to
 * drop down
 */
function aggregate(subSections: TimelineSegment[], fallbackStart: number): Omit<TimelineSegment, "key"> {
  const startedSubs = subSections.filter((sub) => sub.started);
  const ends = subSections.map((sub) => sub.lastGameAt).filter((time): time is number => time !== undefined);
  return {
    start: startedSubs.length > 0 ? Math.min(...startedSubs.map((sub) => sub.start)) : fallbackStart,
    started: startedSubs.length > 0,
    lastGameAt: ends.length > 0 ? Math.max(...ends) : undefined,
    completed: subSections.every((sub) => sub.completed),
    gamesPlayed: subSections.reduce((sum, sub) => sum + sub.gamesPlayed, 0),
    gamesTotal: subSections.reduce((sum, sub) => sum + sub.gamesTotal, 0),
  };
}

type SlotFeeders = { player1?: Partial<TournamentGame>; player2?: Partial<TournamentGame> };

/**
 * When each game in the bracket became available to play: the moment its last participant became
 * known. A participant is known from the bracket start when they are seeded into the game
 * directly, and otherwise from the completion of the game that sent them there. Returns undefined
 * while the game still misses a participant, and for byes and walkovers, which are never played
 */
function gameAvailability(bracket: TournamentBracket): (game: Partial<TournamentGame>) => number | undefined {
  const getGame = (target: TournamentGameTarget): Partial<TournamentGame> | undefined => {
    switch (target.section) {
      case "losers":
        return bracket.losersBracket?.[target.layerIndex]?.[target.gameIndex];
      case "grandFinal":
        return bracket.grandFinal;
      case "bracketReset":
        return bracket.bracketReset;
      case "winners":
      case undefined:
        return bracket.bracket[target.layerIndex]?.[target.gameIndex];
    }
  };

  // Reverse index: for each game, the game that fills each of its two player slots
  const feeders = new Map<Partial<TournamentGame>, SlotFeeders>();
  const allGames: Partial<TournamentGame>[] = [
    ...bracket.bracket.flat(),
    ...(bracket.losersBracket?.flat() ?? []),
    ...(bracket.grandFinal ? [bracket.grandFinal] : []),
  ];
  for (const game of allGames) {
    for (const target of [game.advanceTo, game.loserAdvanceTo]) {
      if (!target) continue;
      const targetGame = getGame(target);
      if (!targetGame) continue;
      const entry = feeders.get(targetGame) ?? {};
      entry[target.role] = game;
      feeders.set(targetGame, entry);
    }
  }

  /** When the player in this slot arrived. Undefined while the slot is still empty */
  const slotFilledAt = (game: Partial<TournamentGame>, role: "player1" | "player2"): number | undefined => {
    if (game[role] === undefined) return undefined;
    const feeder = feeders.get(game)?.[role];
    // No feeder, or a feeder that never handed anyone over: the player was seeded at the start
    if (feeder === undefined) return bracket.bracketStarted;
    return handedOverAt(feeder) ?? bracket.bracketStarted;
  };

  /** When a game passed its players onward. A walkover forwards its lone arrival on the spot */
  const handedOverAt = (game: Partial<TournamentGame>): number | undefined => {
    if (game.completedAt !== undefined) return game.completedAt;
    if (game.walkover && game.winner !== undefined) {
      return slotFilledAt(game, game.player1 !== undefined ? "player1" : "player2");
    }
    return undefined;
  };

  return (game) => {
    if (isPlayableGame(game) === false) return undefined;
    const player1At = slotFilledAt(game, "player1");
    const player2At = slotFilledAt(game, "player2");
    if (player1At === undefined || player2At === undefined) return undefined;
    return Math.max(player1At, player2At);
  };
}

function availableTimes(
  layer: Partial<TournamentGame>[],
  availableAt: (game: Partial<TournamentGame>) => number | undefined,
): number[] {
  return layer.map(availableAt).filter((time): time is number => time !== undefined);
}

export function buildTournamentTimeline(tournament: Tournament): TournamentTimeline | undefined {
  const bracket = tournament.bracket;
  const groupPlay = tournament.groupPlay;
  if (!groupPlay && !bracket) return undefined; // Tournament has not started

  const sections: TimelineSection[] = [];

  if (groupPlay) {
    // All groups start together at the tournament start and are played in parallel
    const subSections: TimelineSubSection[] = groupPlay.groups.map((group, groupIndex) => ({
      ...segment(
        `group-${groupIndex}`,
        tournament.startDate,
        [tournament.startDate],
        completionTimes(group.groupGames),
        group.groupGames.length,
      ),
      ref: { kind: "group", groupIndex },
    }));
    sections.push({
      key: "group-play",
      kind: "group-play",
      parallelSubSections: true,
      subSections,
      ...aggregate(subSections, tournament.startDate),
    });
  }

  if (bracket) {
    const availableAt = gameAvailability(bracket);

    const winnersSubSections: TimelineSubSection[] = [];
    // Layer indexes are inverted: the deepest layer is played first, layer 0 is the final
    const deepestLayer = bracket.bracket.length - 1;
    for (let layerIndex = deepestLayer; layerIndex >= 0; layerIndex--) {
      const layer = bracket.bracket[layerIndex];
      // Only the deepest layer can hold structural byes: empty qualifier slots no one reaches.
      // Every game in a shallower layer is either seeded or fed by the layer below it
      const gamesTotal =
        layerIndex === deepestLayer
          ? layer.filter((game) => game.player1 !== undefined && game.player2 !== undefined).length
          : layer.length;
      if (gamesTotal === 0) continue;
      winnersSubSections.push({
        ...segment(
          `winners-${layerIndex}`,
          bracket.bracketStarted,
          availableTimes(layer, availableAt),
          completionTimes(bracket.bracketGames[layerIndex].played),
          gamesTotal,
        ),
        ref: { kind: "winners-layer", layerIndex },
      });
    }
    if (winnersSubSections.length > 0) {
      sections.push({
        key: "winners",
        kind: "winners",
        parallelSubSections: false,
        subSections: winnersSubSections,
        ...aggregate(winnersSubSections, bracket.bracketStarted),
      });
    }

    const losersBracket = bracket.losersBracket;
    if (losersBracket && losersBracket.length > 0) {
      const totalLayers = losersBracket.length;
      const losersSubSections: TimelineSubSection[] = [];
      for (let layerIndex = totalLayers - 1; layerIndex >= 0; layerIndex--) {
        const gamesTotal = losersBracket[layerIndex].filter(isPlayableGame).length;
        if (gamesTotal === 0) continue; // Round holds only byes and walkovers, so it is never played
        losersSubSections.push({
          ...segment(
            `losers-${layerIndex}`,
            bracket.bracketStarted,
            availableTimes(losersBracket[layerIndex], availableAt),
            completionTimes(bracket.losersBracketGames?.[layerIndex].played ?? []),
            gamesTotal,
          ),
          ref: { kind: "losers-layer", layerIndex, totalLayers },
        });
      }
      if (losersSubSections.length > 0) {
        sections.push({
          key: "losers",
          kind: "losers",
          parallelSubSections: false,
          subSections: losersSubSections,
          ...aggregate(losersSubSections, bracket.bracketStarted),
        });
      }
    }

    const grandFinal = bracket.grandFinal;
    if (grandFinal) {
      // The grand final becomes available the moment the second of the two bracket champions is
      // known, which gameAvailability reads off its player slots like for any other game
      const grandFinalAvailable = availableAt(grandFinal);
      const subSections: TimelineSubSection[] = [
        {
          ...segment(
            "grand-final-game",
            bracket.bracketStarted,
            grandFinalAvailable !== undefined ? [grandFinalAvailable] : [],
            completionTimes([grandFinal]),
            1,
          ),
          ref: { kind: "grand-final-game" },
        },
      ];
      // The bracket reset is only played if the losers bracket champion won the grand final. Its
      // players are copied over rather than advanced, so its availability is the grand final's end
      const bracketReset = bracket.bracketReset;
      if (bracketReset?.player1 !== undefined) {
        subSections.push({
          ...segment(
            "bracket-reset",
            bracket.bracketStarted,
            grandFinal.completedAt !== undefined ? [grandFinal.completedAt] : [],
            completionTimes([bracketReset]),
            1,
          ),
          ref: { kind: "bracket-reset" },
        });
      }
      sections.push({
        key: "grand-final",
        kind: "grand-final",
        parallelSubSections: false,
        subSections,
        ...aggregate(subSections, bracket.bracketStarted),
      });
    }
  }

  return { key: "tournament", ...aggregate(sections, tournament.startDate), sections };
}
