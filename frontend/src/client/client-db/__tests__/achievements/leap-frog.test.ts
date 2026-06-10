import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Leap Frog fires when the winner improves by 3 or more leaderboard ranks
// from a single match. A 3-rank jump needs at least 4 ranked players
// (e.g. rank 4 → rank 1).

describe("Leap Frog Achievement", () => {
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

  it("does NOT fire when there are fewer than 4 ranked players", () => {
    // 2 players, 5 games each → only 2 ranked. Max rank jump = 1.
    const events: EventType[] = [createPlayer("alice", 1), createPlayer("bob", 2)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`g${i}`, 100 + i, "alice", "bob"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("alice").filter((a) => a.type === "leap-frog")).toHaveLength(0);
    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "leap-frog")).toHaveLength(0);
  });

  it("does NOT fire for a 1-rank swap", () => {
    // 2 players, 5 games each, then a rematch that swaps rank 1 and rank 2.
    const events: EventType[] = [createPlayer("alice", 1), createPlayer("bob", 2)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`setup-${i}`, 100 + i, "alice", "bob"));
    }
    for (let i = 0; i < 6; i++) {
      events.push(game(`flip-${i}`, 200 + i, "bob", "alice"));
    }

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    expect(tt.achievements.getAchievements("bob").filter((a) => a.type === "leap-frog")).toHaveLength(0);
  });

  it("awards leap-frog when the winner jumps 3+ ranks in one match", () => {
    // Tight-cluster setup: P1-P5 play a pairwise double round-robin so
    // their Elos converge close to 1000. P6 plays a neutral filler with
    // an L-L-W-W-L sequence — the provisional K swings land P6 at the
    // bottom of the ranked list (rank 7) but close enough to the cluster
    // that beating P5 (rank 3) vaults P6 four ranks up to rank 3.
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

    events.push(game("f-1", t++, "filler", "p6"));
    events.push(game("f-2", t++, "filler", "p6"));
    events.push(game("f-3", t++, "p6", "filler"));
    events.push(game("f-4", t++, "p6", "filler"));
    events.push(game("f-5", t++, "filler", "p6"));

    events.push(game("leap", t++, "p6", "p5"));

    const tt = new TennisTable({ events });
    tt.achievements.calculateAchievements();

    const leaps = tt.achievements.getAchievements("p6").filter((a) => a.type === "leap-frog");
    expect(leaps).toHaveLength(1);
    expect(leaps[0].data?.gameId).toBe("leap");
    expect(leaps[0].data?.ranksJumped).toBeGreaterThanOrEqual(3);
    expect(leaps[0].data?.toRank).toBe(3);
  });
});
