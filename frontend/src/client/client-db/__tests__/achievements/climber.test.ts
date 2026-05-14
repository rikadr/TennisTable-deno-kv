import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Climber fires when the winner improves by 5 or more leaderboard ranks
// from a single match. With K=32 the largest possible Elo swing is ~32, so
// the test needs 6 ranked players tightly clustered (so a single swing
// clears all of them) plus a "low" sixth player ready to leap them.

describe("Climber Achievement", () => {
  const createPlayer = (id: string, time: number): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.PLAYER_CREATED,
    data: { name: id },
  });

  const game = (id: string, time: number, winner: string, loser: string): EventType => ({
    time,
    stream: id,
    type: EventTypeEnum.GAME_CREATED,
    data: { playedAt: time, winner, loser },
  });

  it("does NOT fire when there are fewer than 6 ranked players", () => {
    // 2 players, 5 games each → only 2 ranked. Max rank jump = 1.
    const events: EventType[] = [
      createPlayer("alice", 1),
      createPlayer("bob", 2),
    ];
    for (let i = 0; i < 5; i++) {
      events.push(game(`g${i}`, 100 + i, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "climber")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "climber")).toHaveLength(0);
  });

  it("does NOT fire for a 1-rank swap", () => {
    // 2 players, 5 games each, then a rematch that swaps rank 1 and rank 2.
    const events: EventType[] = [
      createPlayer("alice", 1),
      createPlayer("bob", 2),
    ];
    for (let i = 0; i < 5; i++) {
      events.push(game(`setup-${i}`, 100 + i, "alice", "bob"));
    }
    // Bob wins enough to flip rank.
    for (let i = 0; i < 6; i++) {
      events.push(game(`flip-${i}`, 200 + i, "bob", "alice"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "climber")).toHaveLength(0);
  });

  it("awards climber when the winner jumps 5+ ranks in one match", () => {
    // Setup that produces the climb:
    //   * P1-P5 (cluster): each pair plays twice with one win each (1W-1L
    //     per pair). After 20 games, each cluster player has 8 games and
    //     the cluster's Elos sit tightly between ~995 and ~1005.
    //   * P6 (climber): plays a neutral filler N five times in order
    //     L-L-L-W-W. Net 2W-3L lands P6 at Elo ~994, just below the
    //     cluster floor.
    //   * Final game: P6 beats P1 — P6's Elo jumps over the entire cluster
    //     and the filler, producing a 6-rank improvement.

    const events: EventType[] = [
      createPlayer("p1", 1),
      createPlayer("p2", 2),
      createPlayer("p3", 3),
      createPlayer("p4", 4),
      createPlayer("p5", 5),
      createPlayer("p6", 6),
      createPlayer("filler", 7),
    ];

    let t = 100;
    const cluster = ["p1", "p2", "p3", "p4", "p5"];
    for (let i = 0; i < cluster.length; i++) {
      for (let j = i + 1; j < cluster.length; j++) {
        events.push(game(`rr-${i}-${j}-a`, t++, cluster[i], cluster[j]));
        events.push(game(`rr-${i}-${j}-b`, t++, cluster[j], cluster[i]));
      }
    }

    // P6 plays filler with sequence L-L-L-W-W.
    events.push(game("f-1", t++, "filler", "p6"));
    events.push(game("f-2", t++, "filler", "p6"));
    events.push(game("f-3", t++, "filler", "p6"));
    events.push(game("f-4", t++, "p6", "filler"));
    events.push(game("f-5", t++, "p6", "filler"));

    // The climb itself.
    events.push(game("climb", t++, "p6", "p1"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const climbers = tt.achievements.getAchievements("p6").filter((a) => a.type === "climber");
    expect(climbers).toHaveLength(1);
    expect(climbers[0].data?.gameId).toBe("climb");
    expect(climbers[0].data?.ranksJumped).toBeGreaterThanOrEqual(5);
    expect(climbers[0].data?.toRank).toBe(1);
  });
});
