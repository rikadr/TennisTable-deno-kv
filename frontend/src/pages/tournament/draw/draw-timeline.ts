/**
 * The schedule of the live draw show. The random draw is stored when the tournament starts, and
 * the show is a replay of it on a fixed schedule from the tournament start, so every viewer sees
 * the same reveal at the same moment.
 */
export const DRAW_TIMING = {
  /** From the tournament start to the first reveal. Gives the seeding event time to arrive */
  START_DELAY: 10_000,
  /** One player: the names cycle, then the drawn player is shown */
  PLAYER: 5_000,
  /** The part of PLAYER where the names cycle before they stop on the drawn player */
  CYCLE: 3_500,
  /** Time between two names at the start of the cycle */
  CYCLE_TICK_FASTEST: 40,
  /** Time between two names at the end of the cycle, right before the reveal */
  CYCLE_TICK_SLOWEST: 700,
  /** The full group is shown before the next group starts */
  GROUP_PAUSE: 8_000,
  /** The full board is shown before the page navigates to the tournament */
  END: 5_000,
} as const;

export type DrawStep =
  | { kind: "reveal"; groupIndex: number; slotIndex: number; player: string; startsAt: number; endsAt: number }
  | { kind: "group-pause"; groupIndex: number; startsAt: number; endsAt: number }
  | { kind: "end"; startsAt: number; endsAt: number };

export type DrawSlot =
  /** `fresh` is true while the reveal step of this player is still running: the moment of the draw */
  | { kind: "revealed"; player: string; fresh: boolean }
  /** `startsAt` is the time on the timeline the cycle started, so the UI knows how far it has slowed down */
  | { kind: "cycling"; startsAt: number }
  | { kind: "empty" };

export type DrawBoardState = {
  /** One entry per group, one slot per player */
  groups: DrawSlot[][];
  /** The group the show is at. The last group when the show is at the end */
  currentGroupIndex: number;
  /** The group whose pause runs now: its last player was just drawn */
  celebratingGroupIndex?: number;
  /** True when the end step is over */
  done: boolean;
};

/** The players of each group in the order the random draw placed them */
export function getDrawGroups(groups: string[][], groupSeeding: string[]): string[][] {
  const seedIndex = new Map(groupSeeding.map((player, index) => [player, index]));
  return groups.map((group) => [...group].sort((a, b) => (seedIndex.get(a) ?? 0) - (seedIndex.get(b) ?? 0)));
}

/** The steps of the show in order: every player of group 1, a pause, every player of group 2, and so on */
export function buildDrawTimeline(drawGroups: string[][]): DrawStep[] {
  const steps: DrawStep[] = [];
  let time = 0;
  drawGroups.forEach((group, groupIndex) => {
    group.forEach((player, slotIndex) => {
      steps.push({ kind: "reveal", groupIndex, slotIndex, player, startsAt: time, endsAt: time + DRAW_TIMING.PLAYER });
      time += DRAW_TIMING.PLAYER;
    });
    steps.push({ kind: "group-pause", groupIndex, startsAt: time, endsAt: time + DRAW_TIMING.GROUP_PAUSE });
    time += DRAW_TIMING.GROUP_PAUSE;
  });
  steps.push({ kind: "end", startsAt: time, endsAt: time + DRAW_TIMING.END });
  return steps;
}

export function timelineDuration(steps: DrawStep[]): number {
  return steps.length === 0 ? 0 : steps[steps.length - 1].endsAt;
}

/** The index of the step at this time on the timeline. -1 before the start, `steps.length` after the end */
export function stepIndexAt(steps: DrawStep[], elapsed: number): number {
  if (elapsed < 0) return -1;
  const index = steps.findIndex((step) => elapsed < step.endsAt);
  return index === -1 ? steps.length : index;
}

export function boardStateAt(drawGroups: string[][], steps: DrawStep[], elapsed: number): DrawBoardState {
  const stepIndex = stepIndexAt(steps, elapsed);
  const groups: DrawSlot[][] = drawGroups.map((group) => group.map(() => ({ kind: "empty" })));

  steps.forEach((step, index) => {
    if (step.kind !== "reveal") return;
    const isPast = index < stepIndex;
    const isSettled = index === stepIndex && elapsed - step.startsAt >= DRAW_TIMING.CYCLE;
    if (isPast || isSettled) {
      groups[step.groupIndex][step.slotIndex] = { kind: "revealed", player: step.player, fresh: isSettled };
    } else if (index === stepIndex) {
      groups[step.groupIndex][step.slotIndex] = { kind: "cycling", startsAt: step.startsAt };
    }
  });

  const currentStep = steps[Math.min(Math.max(stepIndex, 0), steps.length - 1)];
  const currentGroupIndex =
    currentStep === undefined || currentStep.kind === "end" ? drawGroups.length - 1 : currentStep.groupIndex;
  const celebratingGroupIndex =
    stepIndex >= 0 && currentStep?.kind === "group-pause" ? currentStep.groupIndex : undefined;

  return {
    groups,
    currentGroupIndex: Math.max(currentGroupIndex, 0),
    celebratingGroupIndex,
    done: stepIndex >= steps.length,
  };
}

/**
 * Skip one step ahead in a local playback that is behind the live schedule. `localStartAt` and
 * `anchor` are wall-clock times: the local playback started at `localStartAt`, the live show at
 * `anchor`. The result is never earlier than the anchor, so the viewer stops at the live position.
 */
export function advanceOneStep(steps: DrawStep[], localStartAt: number, anchor: number, now: number): number {
  const elapsed = now - localStartAt;
  const stepIndex = stepIndexAt(steps, elapsed);
  if (stepIndex >= steps.length) return localStartAt;
  const boundary = stepIndex < 0 ? 0 : steps[stepIndex].endsAt;
  return Math.max(anchor, localStartAt - (boundary - elapsed));
}

/**
 * Time to the next name in a cycle, from the time since the cycle started. The names change
 * fast at first and slow down hard at the end, like a wheel of fortune that comes to a stop.
 */
export function cycleIntervalAt(elapsedInCycle: number): number {
  const progress = Math.min(Math.max(elapsedInCycle / DRAW_TIMING.CYCLE, 0), 1);
  const { CYCLE_TICK_FASTEST, CYCLE_TICK_SLOWEST } = DRAW_TIMING;
  return CYCLE_TICK_FASTEST + (CYCLE_TICK_SLOWEST - CYCLE_TICK_FASTEST) * Math.pow(progress, 3);
}
