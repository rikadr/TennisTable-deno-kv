import {
  DRAW_TIMING,
  advanceOneStep,
  boardStateAt,
  buildDrawTimeline,
  cycleIntervalAt,
  cycleTickIndexAt,
  cycleTickOffsets,
  getDrawGroups,
  stepIndexAt,
  timelineDuration,
} from "./draw-timeline";

const { PLAYER, FOCUS, CYCLE, GROUP_PAUSE, SORT, END } = DRAW_TIMING;

describe("getDrawGroups", () => {
  it("orders the players of each group by their place in the draw", () => {
    const groups = [
      ["P1", "P4", "P6"],
      ["P2", "P3", "P5"],
    ];
    const draw = ["P6", "P3", "P1", "P5", "P4", "P2"];
    expect(getDrawGroups(groups, draw)).toEqual([
      ["P6", "P1", "P4"],
      ["P3", "P5", "P2"],
    ]);
  });
});

describe("buildDrawTimeline", () => {
  const groups = [["A", "B"], ["C"]];
  const steps = buildDrawTimeline(groups);

  it("reveals group by group with a pause after each group and an end step", () => {
    expect(steps.map((s) => s.kind)).toEqual(["reveal", "reveal", "group-pause", "reveal", "group-pause", "end"]);
    expect(steps[0]).toEqual({ kind: "reveal", groupIndex: 0, slotIndex: 0, player: "A", startsAt: 0, endsAt: PLAYER });
    expect(steps[2]).toEqual({
      kind: "group-pause",
      groupIndex: 0,
      startsAt: 2 * PLAYER,
      endsAt: 2 * PLAYER + GROUP_PAUSE,
    });
    expect(steps[3]).toMatchObject({ kind: "reveal", groupIndex: 1, slotIndex: 0, player: "C" });
  });

  it("has a total duration of all players, all pauses and the end", () => {
    expect(timelineDuration(steps)).toBe(3 * PLAYER + 2 * GROUP_PAUSE + END);
    expect(timelineDuration([])).toBe(0);
  });

  it("finds the step at a time", () => {
    expect(stepIndexAt(steps, -1)).toBe(-1);
    expect(stepIndexAt(steps, 0)).toBe(0);
    expect(stepIndexAt(steps, PLAYER)).toBe(1);
    expect(stepIndexAt(steps, 2 * PLAYER + 1)).toBe(2);
    expect(stepIndexAt(steps, timelineDuration(steps))).toBe(steps.length);
  });
});

describe("boardStateAt", () => {
  const groups = [["A", "B"], ["C"]];
  const steps = buildDrawTimeline(groups);

  it("waits on the open slot, cycles it, then settles on the drawn player", () => {
    const waiting = boardStateAt(groups, steps, PLAYER + 100);
    expect(waiting.groups[0]).toEqual([{ kind: "revealed", player: "A", fresh: false }, { kind: "waiting" }]);
    expect(waiting.groups[1]).toEqual([{ kind: "empty" }]);
    expect(waiting.currentGroupIndex).toBe(0);
    expect(waiting.celebratingGroupIndex).toBeUndefined();
    expect(waiting.done).toBe(false);

    const cycling = boardStateAt(groups, steps, PLAYER + FOCUS);
    expect(cycling.groups[0]).toEqual([
      { kind: "revealed", player: "A", fresh: false },
      { kind: "cycling", player: "B", startsAt: PLAYER + FOCUS },
    ]);

    const settled = boardStateAt(groups, steps, PLAYER + FOCUS + CYCLE);
    expect(settled.groups[0]).toEqual([
      { kind: "revealed", player: "A", fresh: false },
      { kind: "revealed", player: "B", fresh: true }, // The moment of the draw
    ]);
    expect(settled.sorted).toEqual([false, false]);
  });

  it("sorts a complete group in the default order from the start of its pause", () => {
    const drawOrder = [["B", "A"], ["C"]];
    const defaultOrder = [["A", "B"], ["C"]];
    const drawSteps = buildDrawTimeline(drawOrder);

    const lastReveal = boardStateAt(drawOrder, drawSteps, 2 * PLAYER - 1, defaultOrder);
    expect(lastReveal.groups[0].map((slot) => slot.kind === "revealed" && slot.player)).toEqual(["B", "A"]);
    expect(lastReveal.sorted).toEqual([false, false]);

    const pause = boardStateAt(drawOrder, drawSteps, 2 * PLAYER, defaultOrder);
    expect(pause.groups[0]).toEqual([
      { kind: "revealed", player: "A", fresh: false },
      { kind: "revealed", player: "B", fresh: false },
    ]);
    expect(pause.sorted).toEqual([true, false]);

    const end = boardStateAt(drawOrder, drawSteps, timelineDuration(drawSteps), defaultOrder);
    expect(end.sorted).toEqual([true, true]);
  });

  it("celebrates a group during its pause only, after its sort", () => {
    expect(boardStateAt(groups, steps, 2 * PLAYER - 1).celebratingGroupIndex).toBeUndefined();
    expect(boardStateAt(groups, steps, 2 * PLAYER).celebratingGroupIndex).toBeUndefined(); // The sort runs
    expect(boardStateAt(groups, steps, 2 * PLAYER + SORT).celebratingGroupIndex).toBe(0);
    expect(boardStateAt(groups, steps, 2 * PLAYER + GROUP_PAUSE).celebratingGroupIndex).toBeUndefined();
    expect(boardStateAt(groups, steps, 3 * PLAYER + GROUP_PAUSE + SORT).celebratingGroupIndex).toBe(1);
    expect(boardStateAt(groups, steps, 3 * PLAYER + 2 * GROUP_PAUSE).celebratingGroupIndex).toBeUndefined();
  });

  it("focuses the next group during and after its pause, and the last group at the end", () => {
    expect(boardStateAt(groups, steps, 2 * PLAYER + 1).currentGroupIndex).toBe(0);
    expect(boardStateAt(groups, steps, 2 * PLAYER + GROUP_PAUSE).currentGroupIndex).toBe(1);
    const end = boardStateAt(groups, steps, 3 * PLAYER + 2 * GROUP_PAUSE + 1);
    expect(end.currentGroupIndex).toBe(1);
    expect(end.groups.flat().every((slot) => slot.kind === "revealed")).toBe(true);
    expect(end.done).toBe(false);
  });

  it("is done after the end step", () => {
    expect(boardStateAt(groups, steps, timelineDuration(steps)).done).toBe(true);
  });

  it("shows an empty board before the start", () => {
    const state = boardStateAt(groups, steps, -500);
    expect(state.groups.flat().every((slot) => slot.kind === "empty")).toBe(true);
    expect(state.currentGroupIndex).toBe(0);
    expect(state.celebratingGroupIndex).toBeUndefined();
  });
});

describe("advanceOneStep", () => {
  const steps = buildDrawTimeline([["A", "B"], ["C"]]);
  const anchor = 1_000_000;

  it("moves the local start back to the end of the current step", () => {
    const localStartAt = anchor + 60_000; // Joined 60 s late
    const now = localStartAt + 1_000; // 1 s into the first reveal
    expect(advanceOneStep(steps, localStartAt, anchor, now)).toBe(localStartAt - (PLAYER - 1_000));
  });

  it("stops at the live position", () => {
    const localStartAt = anchor + 500; // Only 0.5 s behind
    const now = localStartAt + 1_000;
    expect(advanceOneStep(steps, localStartAt, anchor, now)).toBe(anchor);
  });

  it("does nothing when the local show is over", () => {
    const localStartAt = anchor + 60_000;
    const now = localStartAt + timelineDuration(steps) + 1;
    expect(advanceOneStep(steps, localStartAt, anchor, now)).toBe(localStartAt);
  });
});

describe("cycleIntervalAt", () => {
  const { CYCLE_TICK_FASTEST, CYCLE_TICK_SLOWEST } = DRAW_TIMING;

  it("starts fast and ends slow", () => {
    expect(cycleIntervalAt(0)).toBe(CYCLE_TICK_FASTEST);
    expect(cycleIntervalAt(CYCLE)).toBe(CYCLE_TICK_SLOWEST);
  });

  it("only slows down, and brakes hardest at the end", () => {
    const samples = Array.from({ length: 11 }, (_, i) => cycleIntervalAt((CYCLE * i) / 10));
    for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    expect(cycleIntervalAt(CYCLE / 2)).toBeLessThan((CYCLE_TICK_FASTEST + CYCLE_TICK_SLOWEST) / 2);
  });

  it("clamps outside the cycle", () => {
    expect(cycleIntervalAt(-100)).toBe(CYCLE_TICK_FASTEST);
    expect(cycleIntervalAt(CYCLE * 2)).toBe(CYCLE_TICK_SLOWEST);
  });
});

describe("cycleTickOffsets", () => {
  const offsets = cycleTickOffsets();

  it("starts at 0, lands before the reveal and only slows down", () => {
    expect(offsets[0]).toBe(0);
    expect(offsets.length).toBeGreaterThan(20);
    expect(offsets[offsets.length - 1]).toBeLessThanOrEqual(CYCLE - DRAW_TIMING.CYCLE_LANDING);
    expect(offsets[offsets.length - 1]).toBeGreaterThan(
      CYCLE - DRAW_TIMING.CYCLE_LANDING - DRAW_TIMING.CYCLE_TICK_SLOWEST,
    );
    for (let i = 2; i < offsets.length; i++) {
      expect(offsets[i] - offsets[i - 1]).toBeGreaterThanOrEqual(offsets[i - 1] - offsets[i - 2]);
    }
  });

  it("finds the tick shown at a time", () => {
    expect(cycleTickIndexAt(offsets, -10)).toBe(0);
    expect(cycleTickIndexAt(offsets, 0)).toBe(0);
    expect(cycleTickIndexAt(offsets, offsets[1])).toBe(1);
    expect(cycleTickIndexAt(offsets, offsets[5] + 1)).toBe(5);
    expect(cycleTickIndexAt(offsets, CYCLE)).toBe(offsets.length - 1);
  });
});
