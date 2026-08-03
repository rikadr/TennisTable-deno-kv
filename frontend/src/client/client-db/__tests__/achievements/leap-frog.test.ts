import { TennisTable } from "../../tennis-table";
import { EventType, EventTypeEnum } from "../../event-store/event-types";

// Leap Frog is a record-beating achievement (like Marathon Set): it is
// awarded to a winner whose single-game leaderboard jump BEATS the league's
// standing record for the biggest jump. The first qualifying jump of >= 2
// ranks establishes the record; afterwards only a strictly larger jump earns
// the award again. Each award records how many ranks were jumped, the from /
// to rank, and the players that were leapfrogged.

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

  // Deterministic scenario builder. A "pumper" (pmp) only ever wins, so it
  // stays at rank 1 and never jumps up. Cluster members only ever lose (once
  // to the pumper as they are created), so they sink to the bottom in
  // creation order without ever passing anyone. Neither fires a leap-frog, so
  // the setup leaves the record untouched. Each challenger then warms up with
  // a loss (to become ranked and sit just below the cluster) and beats the
  // top cluster member, vaulting the entire cluster in one game. Growing the
  // cluster between challengers makes each successive jump strictly larger.
  // Ranked threshold is overridden to 1 so a single game qualifies a player.
  function buildScenario(challengerClusterSizes: number[]): { events: EventType[]; challengerIds: string[] } {
    const events: EventType[] = [];
    let time = 1;
    const player = (id: string) => events.push(createPlayer(id, time++));
    const g = (w: string, l: string) => events.push(game(`g-${w}-${l}-${time}`, time++, w, l));

    player("pmp");
    const cluster: string[] = [];
    const addClusterMember = (id: string) => {
      player(id);
      g("pmp", id); // sink below 1000; pmp rises and stays on top
      cluster.push(id);
    };

    const challengerIds: string[] = [];
    challengerClusterSizes.forEach((clusterSize, idx) => {
      while (cluster.length < clusterSize) addClusterMember(`c${cluster.length}`);
      const ch = `x${idx}`;
      player(ch);
      const bag = `bag${idx}`;
      player(bag);
      g(bag, ch); // warm-up loss: ranked, and sits just below the cluster
      g(ch, cluster[0]); // vault the whole cluster by beating its top member
      challengerIds.push(ch);
    });

    return { events, challengerIds };
  }

  const leaps = (tt: TennisTable, id: string) =>
    tt.achievements.getAchievements(id).filter((a) => a.type === "leap-frog");

  it("does NOT fire when there are too few ranked players to jump 2 ranks", () => {
    // 2 players → the most anyone can improve is a single 1-rank swap.
    const events: EventType[] = [createPlayer("alice", 1), createPlayer("bob", 2)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`g${i}`, 100 + i, "alice", "bob"));
    }

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 5 });
    tt.achievements.calculateAchievements();

    expect(leaps(tt, "alice")).toHaveLength(0);
    expect(leaps(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.leapFrogRecord).toStrictEqual({ ranksJumped: undefined, holder: undefined });
  });

  it("does NOT fire for a 1-rank swap (below the 2-rank threshold)", () => {
    // 2 players, then a rematch run that swaps rank 1 and rank 2 — a 1-rank
    // move, which is under the minimum jump of 2.
    const events: EventType[] = [createPlayer("alice", 1), createPlayer("bob", 2)];
    for (let i = 0; i < 5; i++) {
      events.push(game(`setup-${i}`, 100 + i, "alice", "bob"));
    }
    for (let i = 0; i < 6; i++) {
      events.push(game(`flip-${i}`, 200 + i, "bob", "alice"));
    }

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 5 });
    tt.achievements.calculateAchievements();

    expect(leaps(tt, "bob")).toHaveLength(0);
    expect(tt.achievements.leapFrogRecord).toStrictEqual({ ranksJumped: undefined, holder: undefined });
  });

  it("awards the first 2-rank jump and establishes the league record", () => {
    const { events } = buildScenario([3]);

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    const awards = leaps(tt, "x0");
    expect(awards).toHaveLength(1);
    expect(awards[0].earnedBy).toBe("x0");
    expect(awards[0].data).toStrictEqual({
      opponent: "c0",
      gameId: "g-x0-c0-11",
      ranksJumped: 2,
      fromRank: 5,
      toRank: 3,
      fromElo: 984,
      toElo: 1000,
      leapfroggedPlayers: ["c1", "c2"],
      previousRecord: undefined, // first jump to set the record
    });
    expect(tt.achievements.leapFrogRecord).toStrictEqual({ ranksJumped: 2, holder: "x0" });
  });

  it("only re-awards when a jump beats the standing record (record-beating chain)", () => {
    // Clusters of 3 → 6 → 9 make x0/x1/x2 jump 2 → 5 → 8. A fourth challenger
    // over the same (ungrown) 9-cluster can only tie/undershoot the record, so
    // it earns nothing.
    const { events, challengerIds } = buildScenario([3, 6, 9, 9]);

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    // All leap-frog awards in chronological order.
    const chain = challengerIds
      .flatMap((id) => leaps(tt, id))
      .sort((a, b) => a.earnedAt - b.earnedAt)
      .map((a) => a.data as { ranksJumped: number; previousRecord?: number });

    const jumps = chain.map((d) => d.ranksJumped);
    expect(jumps).toStrictEqual([2, 5, 8]);

    // Every award beat the previous record: each >= 2, strictly increasing,
    // and previousRecord links to the prior award's jump (undefined for the
    // first).
    expect(jumps.every((j) => j >= 2)).toBe(true);
    expect(jumps.every((j, i) => i === 0 || j > jumps[i - 1])).toBe(true);
    expect(chain.map((d) => d.previousRecord)).toStrictEqual([undefined, ...jumps.slice(0, -1)]);

    // The 4th challenger did not beat the standing record of 8 → no award.
    expect(leaps(tt, "x3")).toHaveLength(0);
    expect(tt.achievements.leapFrogRecord).toStrictEqual({ ranksJumped: 8, holder: "x2" });
  });

  it("progression reports the personal-best jump against the league record", () => {
    // x0 jumps 2, x1 jumps 5 → record ends at 5 held by x1.
    const { events } = buildScenario([3, 6]);

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 1 });
    tt.achievements.calculateAchievements();

    const x1 = tt.achievements.getPlayerProgression("x1")["leap-frog"];
    expect(x1.current).toBe(5); // its own biggest jump
    expect(x1.target).toBe(6); // one beyond the record of 5 it now holds
    expect(x1.recordHolder).toBe("x1");
    expect(x1.earned).toBe(1);

    const x0 = tt.achievements.getPlayerProgression("x0")["leap-frog"];
    expect(x0.current).toBe(2);
    expect(x0.target).toBe(6);
    expect(x0.recordHolder).toBe("x1");
    expect(x0.earned).toBe(1);

    // A cluster member that only ever lost never jumped → no progress.
    const c0 = tt.achievements.getPlayerProgression("c0")["leap-frog"];
    expect(c0.current).toBe(0);
    expect(c0.target).toBe(6);
    expect(c0.recordHolder).toBe("x1");
    expect(c0.earned).toBe(0);
  });

  it("progression shows no record until the first 2-rank jump", () => {
    // Two players only ever swap 1 rank → no record is ever set.
    const events: EventType[] = [createPlayer("alice", 1), createPlayer("bob", 2)];
    for (let i = 0; i < 5; i++) events.push(game(`setup-${i}`, 100 + i, "alice", "bob"));
    for (let i = 0; i < 6; i++) events.push(game(`flip-${i}`, 200 + i, "bob", "alice"));

    const tt = new TennisTable({ events, gameLimitForRankedOverride: 5 });
    tt.achievements.calculateAchievements();

    const bob = tt.achievements.getPlayerProgression("bob")["leap-frog"];
    expect(bob.target).toBeUndefined();
    expect(bob.recordHolder).toBeUndefined();
    expect(bob.earned).toBe(0);
  });
});
