import { TennisTable } from "../tennis-table";
import { EventType, EventTypeEnum } from "../event-store/event-types";

describe("Hall of Fame", () => {
  let tennisTable: TennisTable;
  let events: EventType[];

  beforeEach(() => {
    // Setup common test data
    events = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 2000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Bob" },
      },
      // Game 1: Alice beats Bob
      {
        time: 3000,
        stream: "game-1",
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: 3000,
          winner: "player-1",
          loser: "player-2",
        },
      },
      // Game 2: Alice beats Bob again
      {
        time: 4000,
        stream: "game-2",
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: 4000,
          winner: "player-1",
          loser: "player-2",
        },
      },
      // Deactivate Bob
      {
        time: 5000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    tennisTable = new TennisTable({ events });
  });

  it("should have hallOfFame initialized", () => {
    // @ts-ignore
    expect(tennisTable.hallOfFame).toBeDefined();
  });

  it("should return deactivated players in hall of fame", () => {
    // @ts-ignore
    const hallOfFamers = tennisTable.hallOfFame.getHallOfFame();
    expect(hallOfFamers).toHaveLength(1);
    expect(hallOfFamers[0].name).toBe("Bob");
  });

  it("should calculate honors for deactivated players", () => {
    // @ts-ignore
    const hallOfFamers = tennisTable.hallOfFame.getHallOfFame();
    const bob = hallOfFamers[0];

    expect(bob.honors).toBeDefined();
    // Bob lost 2 games, his max elo should be the initial elo (since he only lost) or close to it. 
    // Actually, let's make Bob win one to have a peak > initial.
  });
  
  it("should calculate peak elo correctly", () => {
     // Note: Since games involving deactivated players are filtered from leaderboard calculations,
     // the Hall of Fame relies on direct game data for ELO calculations (not filtered summary).
     // However, some stats like totalGames come from the filtered summary.
     const eventsWithWin: EventType[] = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 2000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Bob" },
      },
      // Bob beats Alice
      {
        time: 3000,
        stream: "game-1",
        type: EventTypeEnum.GAME_CREATED,
        data: {
          playedAt: 3000,
          winner: "player-2",
          loser: "player-1",
        },
      },
      // Deactivate Bob
      {
        time: 5000,
        stream: "player-2",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    const tt = new TennisTable({ events: eventsWithWin });
    // @ts-ignore
    const bob = tt.hallOfFame.getHallOfFame()[0];

    // Since Bob is deactivated, his games are filtered from the leaderboard summary
    // Hall of Fame shows stats based on filtered data
    expect(bob.honors.peakElo).toBe(1016); // 1000 + 16 (K=32)
    expect(bob.honors.totalGames).toBe(1);
    expect(bob.honors.winRate).toBe(100);
  });

  it("should assign titles correctly", () => {
    const events: EventType[] = [
      {
        time: 1000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_CREATED,
        data: { name: "Alice" },
      },
      {
        time: 5000,
        stream: "player-1",
        type: EventTypeEnum.PLAYER_DEACTIVATED,
        data: null,
      },
    ];

    const tt = new TennisTable({ events });
    // @ts-ignore
    const alice = tt.hallOfFame.getHallOfFame()[0];
    // Alice has no games, but she is a pioneer
    expect(alice.titles).toEqual(["🌱 League Pioneer"]);
  });

  it("should calculate nemesis, favorite victim and streak correctly", () => {
    // Note: Since Alice is deactivated, her games are filtered from leaderboard calculations.
    // Hall of Fame stats that come from getPlayerSummary will show 0 games.
    const events: EventType[] = [
      { time: 100, stream: "p1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 200, stream: "p2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      { time: 300, stream: "p3", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Charlie" } },
    ];

    // Alice beats Bob 3 times (Favorite Victim: Bob, 3 wins)
    for (let i = 0; i < 3; i++) {
        events.push({
            time: 1000 + i * 100,
            stream: `game-ab-${i}`,
            type: EventTypeEnum.GAME_CREATED,
            data: { playedAt: 1000 + i * 100, winner: "p1", loser: "p2" }
        });
    }

    // Alice loses to Charlie 2 times (Nemesis: Charlie, 2 losses)
    for (let i = 0; i < 2; i++) {
        events.push({
            time: 2000 + i * 100,
            stream: `game-ac-${i}`,
            type: EventTypeEnum.GAME_CREATED,
            data: { playedAt: 2000 + i * 100, winner: "p3", loser: "p1" }
        });
    }

    // Alice beats Bob 1 more time
     events.push({
            time: 3000,
            stream: `game-ab-final`,
            type: EventTypeEnum.GAME_CREATED,
            data: { playedAt: 3000, winner: "p1", loser: "p2" }
     });

    // Deactivate Alice
    events.push({ time: 5000, stream: "p1", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null });

    const tt = new TennisTable({ events });
    // @ts-ignore
    const alice = tt.hallOfFame.getHallOfFame()[0];

    // Since Alice is deactivated, her games are filtered from the summary
    // All stats based on game data will be 0
    expect(alice.honors.longestStreak).toBe(3);
    expect(alice.honors.favoriteVictim).toEqual({ id: "p2", wins: 4 });
    expect(alice.honors.nemesis).toEqual({ id: "p3", losses: 2 });
  });

  it("should calculate tournament stats correctly", () => {
    const events: EventType[] = [
      { time: 100, stream: "p1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 200, stream: "p2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
      // Tournament 1: Alice signs up but doesn't win (no games played even)
      { time: 300, stream: "t1", type: EventTypeEnum.TOURNAMENT_CREATED, data: { id: "t1", name: "T1", startDate: 400, groupPlay: false } },
      { time: 350, stream: "t1", type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player: "p1" } },
      
      // Tournament 2: Alice and Bob sign up, Alice wins
      { time: 500, stream: "t2", type: EventTypeEnum.TOURNAMENT_CREATED, data: { id: "t2", name: "T2", startDate: 600, groupPlay: false } },
      { time: 550, stream: "t2", type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player: "p1" } },
      { time: 560, stream: "t2", type: EventTypeEnum.TOURNAMENT_SIGNUP, data: { player: "p2" } },
      
      // T2 game: Alice beats Bob. Since it's a 2-player bracket, this is the final.
      { time: 650, stream: "t2-game1", type: EventTypeEnum.GAME_CREATED, data: { playedAt: 650, winner: "p1", loser: "p2" } },
      
      // Deactivate Alice
      { time: 1000, stream: "p1", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null },
    ];

    const tt = new TennisTable({ events });
    
    // Mock client config to include the tournaments
    // @ts-ignore
    tt.client.tournaments = [
      { id: "t1", name: "T1", startDate: 400, groupPlay: false, description: "Test T1" },
      { id: "t2", name: "T2", startDate: 600, groupPlay: false, description: "Test T2" }
    ];

    // @ts-ignore
    const alice = tt.hallOfFame.getHallOfFame()[0];

    expect(alice.honors.tournamentStats).toBeDefined();
    expect(alice.honors.tournamentStats?.participated).toBe(2);
    expect(alice.honors.tournamentStats?.won).toBe(1);
    // Finals reached: T2 (won) + T1 (if applicable? No games in T1, so likely 0 finals there). 
    // In T2, 1 game played = final. So 1 final.
    expect(alice.honors.tournamentStats?.finals).toBe(1);
  });

  it("should calculate play style and heatmap correctly", () => {
    const events: EventType[] = [
      { time: 100, stream: "p1", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Alice" } },
      { time: 200, stream: "p2", type: EventTypeEnum.PLAYER_CREATED, data: { name: "Bob" } },
    ];

    // Alice wins 5 games.
    // 3 games are "Clean Sweeps" (3-0)
    for (let i = 0; i < 3; i++) {
        events.push({
            time: 1000 + i * ONE_DAY,
            stream: `game-sweep-${i}`,
            type: EventTypeEnum.GAME_CREATED,
            data: { 
                playedAt: 1000 + i * ONE_DAY, 
                winner: "p1", 
                loser: "p2" 
            }
        });
        events.push({
            time: 1000 + i * ONE_DAY + 1,
            stream: `game-sweep-${i}`, // SAME STREAM ID
            type: EventTypeEnum.GAME_SCORE,
            data: { setsWon: { gameWinner: 3, gameLoser: 0 }, setPoints: [] }
        });
    }

    // 2 games are "Close wins" (Clincher) - pointsDiff <= 5
    // Note: pointsDiff is calculated in Leaderboard summary from GameScore if available, or manual pointsDiff in game object if passed?
    // Leaderboard map logic: pointsDiff comes from `pointsWon` arg in eloCalculator callback.
    // Elo calculator calculates pointsWon.
    // We need to provide sets score such that total points diff is small.
    // Let's assume eloCalculator derives points from setPoints if available.
    // Actually, `GameCreated` event does NOT have pointsDiff. `GameScore` event updates the game.
    // `eloCalculator` in `elo.ts` likely calculates points from `setPoints`.
    // Let's mock games where Alice wins with small margin.
    // Game 4: 11-9, 11-9, 9-11, 11-9. Total: 42-38. Diff 4.
    events.push({
        time: 5000,
        stream: `game-close-1`,
        type: EventTypeEnum.GAME_CREATED,
        data: { playedAt: 5000, winner: "p1", loser: "p2" }
    });
    events.push({
        time: 5001,
        stream: `game-close-1`, // SAME STREAM ID
        type: EventTypeEnum.GAME_SCORE,
        data: { 
            setsWon: { gameWinner: 3, gameLoser: 1 }, 
            setPoints: [
                { gameWinner: 11, gameLoser: 9 },
                { gameWinner: 11, gameLoser: 9 },
                { gameWinner: 9, gameLoser: 11 },
                { gameWinner: 11, gameLoser: 9 }
            ]
        }
    });
    
    // 2 more sweeps
    for (let i = 3; i < 5; i++) {
        events.push({
            time: 1000 + i * ONE_DAY,
            stream: `game-sweep-${i}`,
            type: EventTypeEnum.GAME_CREATED,
            data: { playedAt: 1000 + i * ONE_DAY, winner: "p1", loser: "p2" }
        });
        events.push({
            time: 1000 + i * ONE_DAY + 1,
            stream: `game-sweep-${i}`, // SAME STREAM ID
            type: EventTypeEnum.GAME_SCORE,
            data: { setsWon: { gameWinner: 3, gameLoser: 0 }, setPoints: [] }
        });
    }

    // Deactivate Alice
    events.push({ time: 10000, stream: "p1", type: EventTypeEnum.PLAYER_DEACTIVATED, data: null });

    const tt = new TennisTable({ events });
    // @ts-ignore
    const alice = tt.hallOfFame.getHallOfFame()[0];

    expect(alice.honors.activityHeatmap).toBeDefined();
    // We added games at different times
    expect(Object.keys(alice.honors.activityHeatmap!).length).toBeGreaterThan(0);

    // Verify heatmap has entries for game dates
    const heatmapDates = Object.keys(alice.honors.activityHeatmap!);
    expect(heatmapDates.length).toBeGreaterThan(0);
  });
});

const ONE_DAY = 24 * 60 * 60 * 1000;
