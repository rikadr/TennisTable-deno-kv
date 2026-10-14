/**
 * The score of a finished game while the players enter it by hand. Slot 1
 * (`player1`) is the game winner and slot 2 (`player2`) the game loser, for the
 * points and the bad side alike, the same as the GAME_SCORE event.
 */

import { GameScore } from "../client/client-db/event-store/event-types";
import { FillableSetPoints, SetPointsSlot, setWinnerPoints, updateSetPoints } from "./set-points-fill";
import { autoFillBadSides, BadSide, badSideOfGameWinnerSide, gameWinnerSideOfBadSide } from "./table-sides";

/** 1 = the game winner, 2 = the game loser. */
export type DraftSlot = 1 | 2;

export type DraftSet = FillableSetPoints & {
  /** The set winner the players picked before they selected the points. */
  pickedWinner?: DraftSlot;
  badSide: BadSide;
};

export type ScoreDraft = { winnerSets: number; loserSets: number; sets: DraftSet[] };

export const EMPTY_SCORE_DRAFT: ScoreDraft = { winnerSets: 0, loserSets: 0, sets: [] };

/** The results the form offers with 1 press, as [game winner sets, game loser sets]. */
export const RESULT_PRESETS: readonly (readonly [number, number])[] = [
  [1, 0],
  [2, 0],
  [2, 1],
  [3, 0],
  [3, 1],
  [3, 2],
];

export const MAX_SETS_PER_PLAYER = 9;

const slotKey = (slot: DraftSlot): SetPointsSlot => (slot === 1 ? "player1" : "player2");
const otherSlot = (slot: DraftSlot): DraftSlot => (slot === 1 ? 2 : 1);

export function hasResult(draft: ScoreDraft): boolean {
  return draft.winnerSets > 0 || draft.loserSets > 0;
}

export function hasSetPoints(set: DraftSet): set is DraftSet & { player1: number; player2: number } {
  return set.player1 !== undefined && set.player2 !== undefined;
}

function hasAnySetPoints(set: DraftSet): boolean {
  return set.player1 !== undefined || set.player2 !== undefined;
}

/** The winner of a set from its points, or the pick when it has no points. Null for a tie or no data. */
export function knownSetWinner(set: DraftSet): DraftSlot | null {
  if (hasSetPoints(set)) {
    if (set.player1 > set.player2) return 1;
    if (set.player2 > set.player1) return 2;
    return null;
  }
  return set.pickedWinner ?? null;
}

/** The known winner of each set, else the other player once 1 player has all their sets of the result. */
export function setWinners(draft: ScoreDraft): (DraftSlot | null)[] {
  const known = draft.sets.map(knownSetWinner);
  const winnerCount = known.filter((slot) => slot === 1).length;
  const loserCount = known.filter((slot) => slot === 2).length;
  if (winnerCount > draft.winnerSets || loserCount > draft.loserSets) return known;

  let implied: DraftSlot | null = null;
  if (loserCount === draft.loserSets) implied = 1;
  else if (winnerCount === draft.winnerSets) implied = 2;
  return known.map((slot) => slot ?? implied);
}

export function withResult(draft: ScoreDraft, winnerSets: number, loserSets: number): ScoreDraft {
  const totalSets = winnerSets + loserSets;
  const sets = Array.from({ length: totalSets }, (_, index) => draft.sets[index] ?? { badSide: null });
  return { winnerSets, loserSets, sets };
}

function withSet(draft: ScoreDraft, setIndex: number, set: DraftSet): ScoreDraft {
  return { ...draft, sets: draft.sets.map((current, index) => (index === setIndex ? set : current)) };
}

/** A set with points keeps them, swapped so the picked winner has the higher number. */
export function withSetWinner(draft: ScoreDraft, setIndex: number, slot: DraftSlot): ScoreDraft {
  const set = draft.sets[setIndex];
  if (hasSetPoints(set) && knownSetWinner(set) === otherSlot(slot)) {
    const autoFilled = set.autoFilled === undefined ? undefined : set.autoFilled === "player1" ? "player2" : "player1";
    return withSet(draft, setIndex, {
      ...set,
      player1: set.player2,
      player2: set.player1,
      autoFilled,
      pickedWinner: slot,
    });
  }
  return withSet(draft, setIndex, { ...set, pickedWinner: slot });
}

/** Does nothing while the set has no winner, known or implied. */
export function withLoserPoints(draft: ScoreDraft, setIndex: number, loserPoints: number): ScoreDraft {
  const winner = setWinners(draft)[setIndex];
  if (winner === null) return draft;
  return withSet(draft, setIndex, {
    ...draft.sets[setIndex],
    [slotKey(otherSlot(winner))]: loserPoints,
    [slotKey(winner)]: setWinnerPoints(loserPoints),
    autoFilled: slotKey(winner),
    pickedWinner: winner,
  });
}

/** Only for a set with points. A calculated value follows the other slot, see `updateSetPoints`. */
export function withPointsStep(draft: ScoreDraft, setIndex: number, slot: DraftSlot, delta: number): ScoreDraft {
  const set = draft.sets[setIndex];
  if (hasSetPoints(set) === false) return draft;
  const value = Math.max(0, set[slotKey(slot)] + delta);
  const updated = updateSetPoints(set, slotKey(slot), value);
  const winner = knownSetWinner(updated);
  return withSet(draft, setIndex, { ...updated, pickedWinner: winner ?? set.pickedWinner });
}

export function withoutSetPoints(draft: ScoreDraft, setIndex: number): ScoreDraft {
  return withSet(draft, setIndex, { badSide: draft.sets[setIndex].badSide });
}

export function withoutAllSetPoints(draft: ScoreDraft): ScoreDraft {
  return { ...draft, sets: draft.sets.map((set) => ({ badSide: set.badSide })) };
}

/** The first pick fills all sets, see `autoFillBadSides`. */
export function withBadSide(draft: ScoreDraft, setIndex: number, badSide: BadSide): ScoreDraft {
  const filled = autoFillBadSides(
    draft.sets.map((set) => set.badSide),
    setIndex,
    badSide,
  );
  return {
    ...draft,
    sets: draft.sets.map((set, index) => (set.badSide === filled[index] ? set : { ...set, badSide: filled[index] })),
  };
}

export function anySetPoints(draft: ScoreDraft): boolean {
  return draft.sets.some(hasAnySetPoints);
}

export type ScoreDraftIssue =
  /** The game winner does not have more sets than the game loser. */
  | { kind: "result" }
  /** The sets give 1 player more sets than the result. */
  | { kind: "set-winners"; slot: DraftSlot; sets: number; resultSets: number }
  | { kind: "tied-set"; setIndex: number }
  /** Some sets have points and these sets do not. */
  | { kind: "missing-points"; setIndexes: number[] };

/** An empty draft (no result) has no issues: it saves the game without a score. */
export function scoreDraftIssues(draft: ScoreDraft): ScoreDraftIssue[] {
  if (hasResult(draft) === false) return [];
  if (draft.winnerSets <= draft.loserSets) return [{ kind: "result" }];

  const issues: ScoreDraftIssue[] = [];
  const known = draft.sets.map(knownSetWinner);
  const winnerCount = known.filter((slot) => slot === 1).length;
  const loserCount = known.filter((slot) => slot === 2).length;
  if (winnerCount > draft.winnerSets) {
    issues.push({ kind: "set-winners", slot: 1, sets: winnerCount, resultSets: draft.winnerSets });
  }
  if (loserCount > draft.loserSets) {
    issues.push({ kind: "set-winners", slot: 2, sets: loserCount, resultSets: draft.loserSets });
  }

  draft.sets.forEach((set, setIndex) => {
    if (hasSetPoints(set) && set.player1 === set.player2) issues.push({ kind: "tied-set", setIndex });
  });

  if (anySetPoints(draft)) {
    const setIndexes = draft.sets.flatMap((set, index) => (hasSetPoints(set) ? [] : [index]));
    if (setIndexes.length > 0) issues.push({ kind: "missing-points", setIndexes });
  }
  return issues;
}

/** "set 2", "sets 2 and 3", "sets 1, 2 and 4". */
function setList(setIndexes: number[]): string {
  const numbers = setIndexes.map((index) => String(index + 1));
  if (numbers.length === 1) return `set ${numbers[0]}`;
  return `sets ${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

const sets = (count: number) => `${count} ${count === 1 ? "set" : "sets"}`;

export function describeScoreDraftIssue(issue: ScoreDraftIssue, winnerName: string, loserName: string): string {
  switch (issue.kind) {
    case "result":
      return `${winnerName} won the game, so ${winnerName} must win more sets than ${loserName}.`;
    case "set-winners": {
      const name = issue.slot === 1 ? winnerName : loserName;
      return `${name} won ${sets(issue.sets)} below, but the result gives ${name} ${sets(issue.resultSets)}.`;
    }
    case "tied-set":
      return `Set ${issue.setIndex + 1} is a tie. A set must have a winner.`;
    case "missing-points":
      return `Add the points of ${setList(issue.setIndexes)}, or clear the points of all sets.`;
  }
}

/**
 * The score part of the GAME_SCORE event, or null when the draft has no
 * result. Only call it for a draft without issues.
 */
export function scoreDraftToEventData(
  draft: ScoreDraft,
): Pick<GameScore["data"], "setsWon" | "setPoints" | "gameWinnerSides"> | null {
  if (hasResult(draft) === false) return null;
  const sidesAreSet = draft.sets.some((set) => set.badSide !== null);
  return {
    setsWon: { gameWinner: draft.winnerSets, gameLoser: draft.loserSets },
    setPoints: anySetPoints(draft)
      ? draft.sets.map((set) => ({ gameWinner: set.player1 ?? 0, gameLoser: set.player2 ?? 0 }))
      : undefined,
    gameWinnerSides: sidesAreSet ? draft.sets.map((set) => gameWinnerSideOfBadSide(set.badSide, 1)) : undefined,
  };
}

export function scoreDraftOfGameScore(score: GameScore["data"] | undefined): ScoreDraft {
  if (score === undefined) return EMPTY_SCORE_DRAFT;
  const totalSets = score.setsWon.gameWinner + score.setsWon.gameLoser;
  return {
    winnerSets: score.setsWon.gameWinner,
    loserSets: score.setsWon.gameLoser,
    sets: Array.from({ length: totalSets }, (_, index) => ({
      player1: score.setPoints?.[index]?.gameWinner,
      player2: score.setPoints?.[index]?.gameLoser,
      badSide: badSideOfGameWinnerSide(score.gameWinnerSides?.[index], 1),
    })),
  };
}
