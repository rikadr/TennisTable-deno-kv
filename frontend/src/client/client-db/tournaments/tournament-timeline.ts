import { Tournament, TournamentGame } from "./tournament";

/**
 * How long each part of a tournament took, laid out as a sequence of segments that can be drawn as
 * a Gantt style timeline.
 *
 * A segment's clock starts when it became possible to play it, not when its first game happened:
 * waiting for players to show up is part of how long a round took. Concretely that means the round
 * before it finished (its `anchor`), and for a losers bracket round also that the winners bracket
 * round feeding it finished. Group play is the exception - all groups run in parallel from the
 * tournament start.
 *
 * A segment ends at its last completed game. Segments that still have games left to play report
 * `completed: false` and the consumer decides what to draw them up against (usually "now").
 *
 * `started` separates the two kinds of unplayed segment: a round whose clock is running (everything
 * it was waiting on has finished, so its games are playable) has started, while a round still
 * blocked by an earlier one has not. Only started segments have a meaningful `start`.
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
  /** When this segment's clock started */
  start: number;
  /**
   * The segment's clock is running: everything it was waiting on has finished, so its games are
   * playable (or played). False while an earlier round still blocks it
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
 * A segment starts at its anchor - unless a game in it was somehow completed before that, in which
 * case the earliest game wins so the segment never starts after its own first game
 */
function segment(
  key: string,
  anchor: number,
  times: number[],
  gamesTotal: number,
  started: boolean,
): TimelineSegment {
  const gamesPlayed = times.length;
  return {
    key,
    start: gamesPlayed > 0 ? Math.min(anchor, Math.min(...times)) : anchor,
    // A game on the record proves the clock ran, whatever the structure says
    started: started || gamesPlayed > 0,
    lastGameAt: gamesPlayed > 0 ? Math.max(...times) : undefined,
    completed: gamesPlayed >= gamesTotal,
    gamesPlayed,
    gamesTotal,
  };
}

/**
 * Roll a list of sub sections up into the totals of the section holding them. A section starts
 * where its first sub section starts, which for the losers bracket is later than the bracket
 * itself: it can only get going once the first winners round has produced someone to drop down
 */
function aggregate(subSections: TimelineSegment[], anchor: number): Omit<TimelineSegment, "key"> {
  const ends = subSections.map((sub) => sub.lastGameAt).filter((time): time is number => time !== undefined);
  return {
    start: subSections.length > 0 ? Math.min(...subSections.map((sub) => sub.start)) : anchor,
    started: subSections.some((sub) => sub.started),
    lastGameAt: ends.length > 0 ? Math.max(...ends) : undefined,
    completed: subSections.every((sub) => sub.completed),
    gamesPlayed: subSections.reduce((sum, sub) => sum + sub.gamesPlayed, 0),
    gamesTotal: subSections.reduce((sum, sub) => sum + sub.gamesTotal, 0),
  };
}

/** The time a segment handed over to the next one, or undefined while it is still being played */
function handoverTime(sub: TimelineSegment | undefined): number | undefined {
  return sub?.completed ? sub.lastGameAt : undefined;
}

export function buildTournamentTimeline(tournament: Tournament): TournamentTimeline | undefined {
  const bracket = tournament.bracket;
  const groupPlay = tournament.groupPlay;
  if (!groupPlay && !bracket) return undefined; // Tournament has not started

  const sections: TimelineSection[] = [];

  if (groupPlay) {
    // All groups start together at the tournament start and are played in parallel
    const subSections: TimelineSubSection[] = groupPlay.groups.map((group, groupIndex) => ({
      ...segment(`group-${groupIndex}`, tournament.startDate, completionTimes(group.groupGames), group.groupGames.length, true),
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
    const winnersSubSections: TimelineSubSection[] = [];
    // Layer indexes are inverted: the deepest layer is played first, layer 0 is the final
    const deepestLayer = bracket.bracket.length - 1;
    let anchor = bracket.bracketStarted;
    // The first playable round is open from the bracket start. Each round after it only starts
    // once the round before it has handed over
    let clockRunning = true;
    for (let layerIndex = deepestLayer; layerIndex >= 0; layerIndex--) {
      const layer = bracket.bracket[layerIndex];
      // Only the deepest layer can hold structural byes: empty qualifier slots no one reaches.
      // Every game in a shallower layer is either seeded or fed by the layer below it
      const gamesTotal =
        layerIndex === deepestLayer
          ? layer.filter((game) => game.player1 !== undefined && game.player2 !== undefined).length
          : layer.length;
      if (gamesTotal === 0) continue;
      const sub: TimelineSubSection = {
        ...segment(
          `winners-${layerIndex}`,
          anchor,
          completionTimes(bracket.bracketGames[layerIndex].played),
          gamesTotal,
          clockRunning,
        ),
        ref: { kind: "winners-layer", layerIndex },
      };
      winnersSubSections.push(sub);
      anchor = handoverTime(sub) ?? anchor;
      clockRunning = sub.completed;
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
      const winnersLayerCount = bracket.bracket.length;
      const losersSubSections: TimelineSubSection[] = [];
      let losersAnchor = bracket.bracketStarted;
      let losersClockRunning = true;
      for (let layerIndex = totalLayers - 1; layerIndex >= 0; layerIndex--) {
        const gamesTotal = losersBracket[layerIndex].filter(isPlayableGame).length;
        if (gamesTotal === 0) continue; // Round holds only byes and walkovers, so it is never played
        // A losers round can only start once the winners round that drops players into it is done.
        // Round 1 takes the first winners round's losers, later even ("major") rounds take the
        // losers of one winners round each. Odd rounds are played among losers only
        const round = totalLayers - layerIndex;
        const feederLayerIndex =
          round === 1 ? winnersLayerCount - 1 : round % 2 === 0 ? winnersLayerCount - 1 - round / 2 : undefined;
        const feederSub =
          feederLayerIndex === undefined
            ? undefined
            : winnersSubSections.find((sub) => sub.key === `winners-${feederLayerIndex}`);
        const feederEnd = handoverTime(feederSub);
        // A feeder round that never made it into the timeline holds no playable games, so it
        // cannot block this round
        const feederDone = feederLayerIndex === undefined || (feederSub?.completed ?? true);
        const sub: TimelineSubSection = {
          ...segment(
            `losers-${layerIndex}`,
            Math.max(losersAnchor, feederEnd ?? losersAnchor),
            completionTimes(bracket.losersBracketGames?.[layerIndex].played ?? []),
            gamesTotal,
            losersClockRunning && feederDone,
          ),
          ref: { kind: "losers-layer", layerIndex, totalLayers },
        };
        losersSubSections.push(sub);
        losersAnchor = handoverTime(sub) ?? losersAnchor;
        losersClockRunning = sub.completed;
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
      // The grand final waits for both bracket champions
      const feederSections = ["winners", "losers"].map((key) => sections.find((section) => section.key === key));
      const bracketChampionsReady = feederSections.map((section) => handoverTime(section) ?? bracket.bracketStarted);
      const grandFinalAnchor = Math.max(bracket.bracketStarted, ...bracketChampionsReady);
      // A bracket section that never made it into the timeline has no games left to play
      const championsKnown = feederSections.every((section) => section?.completed ?? true);

      const subSections: TimelineSubSection[] = [
        {
          ...segment("grand-final-game", grandFinalAnchor, completionTimes([grandFinal]), 1, championsKnown),
          ref: { kind: "grand-final-game" },
        },
      ];
      // The bracket reset is only played if the losers bracket champion won the grand final
      const bracketReset = bracket.bracketReset;
      if (bracketReset?.player1 !== undefined) {
        subSections.push({
          ...segment(
            "bracket-reset",
            handoverTime(subSections[0]) ?? grandFinalAnchor,
            completionTimes([bracketReset]),
            1,
            subSections[0].completed,
          ),
          ref: { kind: "bracket-reset" },
        });
      }
      sections.push({
        key: "grand-final",
        kind: "grand-final",
        parallelSubSections: false,
        subSections,
        ...aggregate(subSections, grandFinalAnchor),
      });
    }
  }

  return { key: "tournament", ...aggregate(sections, tournament.startDate), sections };
}
