import { appendPoint, removeLastPoint, toEventTrackingData, TrackedSet } from "./point-sequences";
import { BadSide } from "./table-sides";

describe("appendPoint", () => {
  it("appends the player's digit and the time of the point", () => {
    expect(appendPoint({ sequence: "", pointTimes: [] }, 1, 500)).toEqual({ sequence: "1", pointTimes: [500] });
    expect(appendPoint({ sequence: "112", pointTimes: [1, 2, 3] }, 2, 4)).toEqual({
      sequence: "1122",
      pointTimes: [1, 2, 3, 4],
    });
  });
});

describe("removeLastPoint", () => {
  it("removes the player's last point and keeps later points with their times", () => {
    const set: TrackedSet = { sequence: "1121", pointTimes: [10, 20, 30, 40] };
    expect(removeLastPoint(set, 2)).toEqual({ sequence: "111", pointTimes: [10, 20, 40] });
    expect(removeLastPoint(set, 1)).toEqual({ sequence: "112", pointTimes: [10, 20, 30] });
  });

  it("returns the set unchanged when the player has no points", () => {
    const set: TrackedSet = { sequence: "111", pointTimes: [1, 2, 3] };
    expect(removeLastPoint(set, 2)).toBe(set);
    expect(removeLastPoint({ sequence: "", pointTimes: [] }, 1)).toEqual({ sequence: "", pointTimes: [] });
  });
});

describe("toEventTrackingData", () => {
  const completedSets = [
    { player1: 3, player2: 1 },
    { player1: 1, player2: 2 },
  ];
  const startedAt = 1_000_000;
  // Set 1 runs 10s, 20s, 30s and 40s in. Set 2 starts after a 60s break.
  const trackedSets: TrackedSet[] = [
    { sequence: "1211", pointTimes: [10_000, 20_000, 30_000, 40_000].map((ms) => startedAt + ms) },
    { sequence: "212", pointTimes: [100_000, 105_500, 111_000].map((ms) => startedAt + ms) },
  ];
  const params = {
    completedSets,
    trackedSets,
    firstServers: [1, 2] as (1 | 2)[],
    badSides: [1, 2] as BadSide[],
    source: "track-game" as const,
    startedAt,
    endedAt: startedAt + 120_000,
    corrections: 2,
  };

  it("encodes sequences as W/L from the game winner's perspective", () => {
    expect(toEventTrackingData({ ...params, player1IsGameWinner: true })?.pointSequences).toEqual(["WLWW", "LWL"]);
    expect(toEventTrackingData({ ...params, player1IsGameWinner: false })?.pointSequences).toEqual(["LWLL", "WLW"]);
  });

  it("stores each point as tenths of a second since the previous point", () => {
    const tracking = toEventTrackingData({ ...params, player1IsGameWinner: true })?.tracking;
    // The first delta of set 2 is the break since the last point of set 1.
    expect(tracking?.pointDeltas).toEqual([
      [100, 100, 100, 100],
      [600, 55, 55],
    ]);
    expect(tracking?.endedAfter).toBe(90);
    expect(tracking?.startedAt).toBe(startedAt);
  });

  it("keeps the deltas in step with the total instead of drifting", () => {
    // Each gap rounds down on its own, but the sum must still reach 3.0s.
    const drifting: TrackedSet[] = [
      { sequence: "1211", pointTimes: [749, 1_499, 2_249, 2_999].map((ms) => startedAt + ms) },
      trackedSets[1],
    ];
    const tracking = toEventTrackingData({ ...params, trackedSets: drifting, player1IsGameWinner: true })?.tracking;
    expect(tracking?.pointDeltas[0]).toEqual([7, 8, 7, 8]);
    expect(tracking?.pointDeltas[0].reduce((sum, delta) => sum + delta, 0)).toBe(30);
  });

  it("never produces a negative delta when a point time goes backwards", () => {
    const backwards: TrackedSet[] = [
      { sequence: "1211", pointTimes: [10_000, 9_000, 30_000, 40_000].map((ms) => startedAt + ms) },
      trackedSets[1],
    ];
    const tracking = toEventTrackingData({ ...params, trackedSets: backwards, player1IsGameWinner: true })?.tracking;
    expect(tracking?.pointDeltas[0]).toEqual([100, 0, 200, 100]);
  });

  it("encodes the first server of each set from the game winner's perspective", () => {
    expect(toEventTrackingData({ ...params, player1IsGameWinner: true })?.tracking.firstServers).toBe("WL");
    expect(toEventTrackingData({ ...params, player1IsGameWinner: false })?.tracking.firstServers).toBe("LW");
  });

  it("encodes the bad side of each set from the game winner's perspective", () => {
    // Player 1 has the bad side in set 1, player 2 in set 2.
    expect(toEventTrackingData({ ...params, player1IsGameWinner: true })?.tracking.winnerSides).toBe("BG");
    expect(toEventTrackingData({ ...params, player1IsGameWinner: false })?.tracking.winnerSides).toBe("GB");
  });

  it("encodes a set with 2 equally good sides as N", () => {
    const badSides: BadSide[] = ["neutral", "neutral"];
    expect(toEventTrackingData({ ...params, badSides, player1IsGameWinner: true })?.tracking.winnerSides).toBe("NN");
  });

  it("leaves out the sides when a set has none, and keeps the rest of the data", () => {
    const tracking = toEventTrackingData({ ...params, badSides: [1, null], player1IsGameWinner: true })?.tracking;
    expect(tracking?.winnerSides).toBeUndefined();
    expect(tracking?.firstServers).toBe("WL");
  });

  it("leaves out the sides when they do not count up to the completed sets", () => {
    expect(
      toEventTrackingData({ ...params, badSides: [1], player1IsGameWinner: true })?.tracking.winnerSides,
    ).toBeUndefined();
    expect(
      toEventTrackingData({ ...params, badSides: [], player1IsGameWinner: true })?.tracking.winnerSides,
    ).toBeUndefined();
  });

  it("keeps the source and the correction count", () => {
    const tracking = toEventTrackingData({ ...params, player1IsGameWinner: true })?.tracking;
    expect(tracking?.version).toBe(1);
    expect(tracking?.source).toBe("track-game");
    expect(tracking?.corrections).toBe(2);
  });

  it("returns undefined when there are no completed sets", () => {
    expect(
      toEventTrackingData({
        ...params,
        completedSets: [],
        trackedSets: [],
        firstServers: [],
        badSides: [],
        player1IsGameWinner: true,
      }),
    ).toBeUndefined();
  });

  it("returns undefined when a set has no sequence", () => {
    expect(
      toEventTrackingData({ ...params, trackedSets: [trackedSets[0]], player1IsGameWinner: true }),
    ).toBeUndefined();
  });

  it("returns undefined when a sequence does not match its set's points", () => {
    const wrong: TrackedSet[] = [trackedSets[0], { sequence: "211", pointTimes: trackedSets[1].pointTimes }];
    expect(toEventTrackingData({ ...params, trackedSets: wrong, player1IsGameWinner: true })).toBeUndefined();
  });

  it("returns undefined when a set has no time for every point", () => {
    const missing: TrackedSet[] = [{ sequence: "1211", pointTimes: [1, 2, 3] }, trackedSets[1]];
    expect(toEventTrackingData({ ...params, trackedSets: missing, player1IsGameWinner: true })).toBeUndefined();
  });

  it("returns undefined when a set has no first server", () => {
    expect(toEventTrackingData({ ...params, firstServers: [1], player1IsGameWinner: true })).toBeUndefined();
  });

  it("returns undefined when the match was never started or ended", () => {
    expect(toEventTrackingData({ ...params, startedAt: null, player1IsGameWinner: true })).toBeUndefined();
    expect(toEventTrackingData({ ...params, endedAt: null, player1IsGameWinner: true })).toBeUndefined();
  });
});
