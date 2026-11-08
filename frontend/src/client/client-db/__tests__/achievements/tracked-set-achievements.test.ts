import { EventType, EventTypeEnum, GameTracking } from "../../event-store/event-types";
import { TennisTable } from "../../tennis-table";
import {
  longestServeRuns,
  SET_POINT_SAVER_TARGET,
  setPointsSavedInSets,
  TURNAROUND_MIN_DEFICIT,
} from "../../achievements";

// Builds the table and calculates the achievements.
const table = (data: ConstructorParameters<typeof TennisTable>[0]): TennisTable => {
  const tt = new TennisTable(data);
  tt.achievements.calculateAchievements();
  return tt;
};

// Turnaround, Set Point Saver and Server Master read the point log of a
// tracked game. Alice is always the game winner ("W"), Bob the game loser ("L").

const baseEvents: EventType[] = [
  { type: EventTypeEnum.PLAYER_CREATED, stream: "alice", time: 1, data: { name: "Alice" } },
  { type: EventTypeEnum.PLAYER_CREATED, stream: "bob", time: 2, data: { name: "Bob" } },
];

const points = (sequence: string) => ({
  gameWinner: [...sequence].filter((point) => point === "W").length,
  gameLoser: [...sequence].filter((point) => point === "L").length,
});

const tracking = (sequences: string[], firstServers: string): GameTracking => ({
  version: 1,
  source: "track-game",
  startedAt: 1,
  pointDeltas: sequences.map((sequence) => [...sequence].map(() => 10)),
  endedAfter: 0,
  firstServers,
  corrections: 0,
});

const trackedGame = (id: string, time: number, sequences: string[], firstServers?: string): EventType[] => {
  const setPoints = sequences.map(points);
  const winnerSets = setPoints.filter((set) => set.gameWinner > set.gameLoser).length;
  return [
    { type: EventTypeEnum.GAME_CREATED, stream: id, time, data: { winner: "alice", loser: "bob", playedAt: time } },
    {
      type: EventTypeEnum.GAME_SCORE,
      stream: id,
      time: time + 1,
      data: {
        setsWon: { gameWinner: winnerSets, gameLoser: setPoints.length - winnerSets },
        setPoints,
        pointSequences: sequences,
        tracking: tracking(sequences, firstServers ?? "W".repeat(sequences.length)),
      },
    },
  ];
};

const awards = (tt: TennisTable, playerId: string, type: string) =>
  tt.achievements.getAchievements(playerId).filter((a) => a.type === type);

describe("Turnaround Achievement", () => {
  it("awards the set winner who came back from 6 points behind, for each such set", () => {
    // Set 1: Alice trails 0–6, then wins 11–6. Set 2: Alice trails 1–7, wins 11–7.
    const set1 = "LLLLLL" + "W".repeat(11);
    const set2 = "WLLLLLLL" + "W".repeat(10);
    const tt = table({ events: [...baseEvents, ...trackedGame("g1", 100, [set1, set2])] });

    const alice = awards(tt, "alice", "turnaround");
    expect(alice).toHaveLength(2);
    expect(alice[0].data).toEqual({
      gameId: "g1",
      opponent: "bob",
      setNumber: 1,
      deficit: 6,
      trailingPoints: 0,
      trailingOpponentPoints: 6,
      playerPoints: 11,
      opponentPoints: 6,
    });
    expect(alice[1].data).toMatchObject({ setNumber: 2, deficit: 6, trailingPoints: 1, trailingOpponentPoints: 7 });
    expect(awards(tt, "bob", "turnaround")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice").turnaround.earned).toBe(2);
  });

  it("gives no award for a smaller deficit, and shows the largest one as progress", () => {
    const set = "L".repeat(TURNAROUND_MIN_DEFICIT - 1) + "W".repeat(11);
    const tt = table({ events: [...baseEvents, ...trackedGame("g1", 100, [set])] });

    expect(awards(tt, "alice", "turnaround")).toHaveLength(0);
    expect(tt.achievements.getPlayerProgression("alice").turnaround.current).toBe(TURNAROUND_MIN_DEFICIT - 1);
  });

  it("awards the game loser who won a set after trailing", () => {
    // Bob wins set 2 from 0–6 down. Alice wins sets 1 and 3.
    const won = "W".repeat(11);
    const bobComeback = "WWWWWW" + "L".repeat(11);
    const tt = table({ events: [...baseEvents, ...trackedGame("g1", 100, [won, bobComeback, won])] });

    expect(awards(tt, "bob", "turnaround")).toHaveLength(1);
    expect(awards(tt, "bob", "turnaround")[0].data).toMatchObject({ opponent: "alice", setNumber: 2 });
  });
});

describe("Set Point Saver Achievement", () => {
  // Bob leads 10–8, so he has set point. Alice wins the next 4 points: 12–10.
  const savedSet = "WWWWWWWWLLLLLLLLLLWWWW";

  it("finds the sets won after the opponent had set point", () => {
    const tt = table({
      events: [...baseEvents, ...trackedGame("g1", 100, [savedSet, "W".repeat(11)])],
    });
    expect(setPointsSavedInSets(tt.games[0])).toEqual([{ setNumber: 1, setWinner: "gameWinner" }]);
  });

  it("does not count 10–10, which is no set point", () => {
    const set = "W".repeat(10) + "L".repeat(10) + "WW";
    const tt = table({ events: [...baseEvents, ...trackedGame("g1", 100, [set])] });
    expect(setPointsSavedInSets(tt.games[0])).toEqual([]);
  });

  it("awards once, at the game with the fifth saved set", () => {
    const games = Array.from({ length: SET_POINT_SAVER_TARGET + 1 }, (_, index) =>
      trackedGame(`g${index}`, 100 * (index + 1), [savedSet]),
    ).flat();
    const tt = table({ events: [...baseEvents, ...games] });

    const alice = awards(tt, "alice", "set-point-saver");
    expect(alice).toHaveLength(1);
    expect(alice[0].earnedByGame).toBe(`g${SET_POINT_SAVER_TARGET - 1}`);
    expect(tt.achievements.getPlayerProgression("alice")["set-point-saver"].current).toBe(SET_POINT_SAVER_TARGET);
    expect(tt.achievements.getPlayerProgression("bob")["set-point-saver"].current).toBe(0);
  });
});

describe("Server Master Achievement", () => {
  it("counts only the serve points of each player, and continues across sets", () => {
    // Alice serves first: points 1–2, 5–6, 9–10 ... She wins all her serve
    // points. Bob wins his own serve points 3–4 and loses 7–8.
    const set = "WWLLWWWWWWWWWWW";
    const tt = table({ events: [...baseEvents, ...trackedGame("g1", 100, [set], "W")] });

    // Alice serves points 1, 2, 5, 6, 9, 10, 13, 14: 8 points, all won.
    expect(longestServeRuns(tt.games[0])).toEqual({ gameWinner: 8, gameLoser: 2 });
  });

  it("awards once, when a player first wins 10 serve points in a row", () => {
    // Alice wins every point and serves first in both sets: 6 serve points in
    // set 1 (11 points) and 6 in set 2, so the run reaches 12 across the sets.
    // In g2 she does the same in 3 sets, so the run reaches 18.
    const set = "W".repeat(11);
    const tt = table({
      events: [
        ...baseEvents,
        ...trackedGame("g1", 100, [set, set], "WW"),
        ...trackedGame("g2", 200, [set, set, set], "WWW"),
      ],
    });

    const alice = awards(tt, "alice", "server-master");
    expect(alice).toHaveLength(1);
    expect(alice[0].data).toEqual({ gameId: "g1", opponent: "bob", points: 12 });
    expect(tt.achievements.getPlayerProgression("alice")["server-master"].current).toBe(18);
  });

  it("needs serve data", () => {
    const tt = table({
      events: [
        ...baseEvents,
        {
          type: EventTypeEnum.GAME_CREATED,
          stream: "g1",
          time: 100,
          data: { winner: "alice", loser: "bob", playedAt: 100 },
        },
        {
          type: EventTypeEnum.GAME_SCORE,
          stream: "g1",
          time: 101,
          data: {
            setsWon: { gameWinner: 1, gameLoser: 0 },
            setPoints: [points("W".repeat(11))],
            pointSequences: ["W".repeat(11)],
          },
        },
      ],
    });
    expect(longestServeRuns(tt.games[0])).toBeUndefined();
  });
});
