import {
  DRAW_TIMING,
  advanceOneStep,
  boardStateAt,
  buildDrawTimeline,
  getDrawGroups,
  stepIndexAt,
  timelineDuration,
} from "./draw-timeline";

const { PLAYER, CYCLE, GROUP_PAUSE, END } = DRAW_TIMING;

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

  it("cycles the open slot, then settles on the drawn player", () => {
    const cycling = boardStateAt(groups, steps, PLAYER + 100);
    expect(cycling.groups[0]).toEqual([{ kind: "revealed", player: "A", fresh: false }, { kind: "cycling" }]);
    expect(cycling.groups[1]).toEqual([{ kind: "empty" }]);
    expect(cycling.currentGroupIndex).toBe(0);
    expect(cycling.celebratingGroupIndex).toBeUndefined();
    expect(cycling.done).toBe(false);

    const settled = boardStateAt(groups, steps, PLAYER + CYCLE);
    expect(settled.groups[0]).toEqual([
      { kind: "revealed", player: "A", fresh: false },
      { kind: "revealed", player: "B", fresh: true }, // The moment of the draw
    ]);
  });

  it("celebrates a group during its pause only", () => {
    expect(boardStateAt(groups, steps, 2 * PLAYER - 1).celebratingGroupIndex).toBeUndefined();
    expect(boardStateAt(groups, steps, 2 * PLAYER).celebratingGroupIndex).toBe(0);
    expect(boardStateAt(groups, steps, 2 * PLAYER + GROUP_PAUSE).celebratingGroupIndex).toBeUndefined();
    expect(boardStateAt(groups, steps, 3 * PLAYER + GROUP_PAUSE).celebratingGroupIndex).toBe(1);
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
