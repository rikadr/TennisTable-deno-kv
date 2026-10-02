import { useMemo } from "react";
import { GameScore } from "../../client/client-db/event-store/event-types";
import { Game } from "../../client/client-db/event-store/projectors/games-projector";
import { GameTag } from "../../client/client-db/game-tags";
import { Fraction } from "../../client/client-db/predictions";
import { useEventDbContext } from "../../wrappers/event-db-context";

export type PvpSet = { p1: number; p2: number };

export type PvpGame = {
  game: Game;
  time: number;
  p1Won: boolean;
  setsP1?: number;
  setsP2?: number;
  sets: PvpSet[];
  /** Elo points that moved from the loser to the winner */
  points: number;
  p1EloAfter: number;
  p2EloAfter?: number;
  tags: GameTag[];
  score?: GameScore["data"];
  /** Player 1 wins minus player 2 wins, after this game */
  lead: number;
};

export type PvpSide = {
  id: string;
  name: string;
  wins: number;
  sets: number;
  points: number;
  decidingWins: number;
  closeSetWins: number;
  longestStreak: number;
  eloNet: number;
  elo: number;
  rank?: number;
  isRanked: boolean;
  biggestWin?: PvpGame;
};

export type PvpData = {
  p1: PvpSide;
  p2: PvpSide;
  games: PvpGame[];
  scoredGames: number;
  decidingGames: number;
  closeSets: number;
  totalSets: number;
  currentStreak?: { player: "p1" | "p2"; length: number };
  prediction?: Fraction;
  eloSeries: { time: number; p1?: number; p2?: number; h2h?: boolean }[];
  insights: string[];
};

const isCloseSet = (set: PvpSet) => Math.max(set.p1, set.p2) > 11 || Math.abs(set.p1 - set.p2) <= 2;

export function usePvpData(player1?: string, player2?: string): PvpData | undefined {
  const context = useEventDbContext();

  return useMemo(() => {
    if (!player1 || !player2) return undefined;
    const s1 = context.leaderboard.getPlayerSummary(player1);
    const s2 = context.leaderboard.getPlayerSummary(player2);
    const p2EloByTime = new Map(s2.games.map((game) => [game.time, game.eloAfterGame]));
    const gameByTime = new Map(
      context.games
        .filter((g) => [g.winner, g.loser].includes(player1) && [g.winner, g.loser].includes(player2))
        .map((g) => [g.playedAt, g]),
    );

    let lead = 0;
    const games: PvpGame[] = [];
    for (const summaryGame of s1.games) {
      if (summaryGame.oponent !== player2) continue;
      const game = gameByTime.get(summaryGame.time);
      if (!game) continue;
      const p1Won = summaryGame.result === "win";
      lead += p1Won ? 1 : -1;
      const score = summaryGame.score;
      const sets =
        score?.setPoints?.map((set) =>
          p1Won ? { p1: set.gameWinner, p2: set.gameLoser } : { p1: set.gameLoser, p2: set.gameWinner },
        ) ?? [];
      games.push({
        game,
        time: summaryGame.time,
        p1Won,
        setsP1: score ? (p1Won ? score.setsWon.gameWinner : score.setsWon.gameLoser) : undefined,
        setsP2: score ? (p1Won ? score.setsWon.gameLoser : score.setsWon.gameWinner) : undefined,
        sets,
        points: Math.abs(summaryGame.pointsDiff),
        p1EloAfter: summaryGame.eloAfterGame,
        p2EloAfter: p2EloByTime.get(summaryGame.time),
        tags: context.gameTags.getTags(game),
        score,
        lead,
      });
    }

    const side = (id: string, summary: typeof s1, isP1: boolean): PvpSide => {
      const mine = (g: PvpGame) => (isP1 ? g.p1Won : !g.p1Won);
      let longest = 0;
      let run = 0;
      let biggestWin: PvpGame | undefined;
      const margin = (g: PvpGame) => g.sets.reduce((sum, set) => sum + (isP1 ? set.p1 - set.p2 : set.p2 - set.p1), 0);
      for (const g of games) {
        if (mine(g)) {
          run++;
          longest = Math.max(longest, run);
          if (g.sets.length && (!biggestWin || margin(g) > margin(biggestWin))) biggestWin = g;
        } else run = 0;
      }
      const allSets = games.flatMap((g) => g.sets);
      return {
        id,
        name: context.playerName(id),
        wins: games.filter(mine).length,
        sets: games.reduce((sum, g) => sum + ((isP1 ? g.setsP1 : g.setsP2) ?? 0), 0),
        points: allSets.reduce((sum, set) => sum + (isP1 ? set.p1 : set.p2), 0),
        decidingWins: games.filter((g) => g.sets.length === 3 && mine(g)).length,
        closeSetWins: allSets.filter((set) => isCloseSet(set) && (isP1 ? set.p1 > set.p2 : set.p2 > set.p1)).length,
        longestStreak: longest,
        eloNet: games.reduce((sum, g) => sum + (mine(g) ? g.points : -g.points), 0),
        elo: summary.elo,
        rank: summary.rank,
        isRanked: summary.isRanked,
        biggestWin,
      };
    };

    const p1 = side(player1, s1, true);
    const p2 = side(player2, s2, false);

    let currentStreak: PvpData["currentStreak"];
    const last = games[games.length - 1];
    if (last) {
      let length = 0;
      for (let i = games.length - 1; i >= 0 && games[i].p1Won === last.p1Won; i--) length++;
      currentStreak = { player: last.p1Won ? "p1" : "p2", length };
    }

    const allSets = games.flatMap((g) => g.sets);
    const firstTime = games[0]?.time ?? 0;
    const h2hTimes = new Set(games.map((g) => g.time));
    const eloSeries = [
      ...s1.games.filter((g) => g.time >= firstTime).map((g) => ({ time: g.time, p1: g.eloAfterGame })),
      ...s2.games.filter((g) => g.time >= firstTime).map((g) => ({ time: g.time, p2: g.eloAfterGame })),
    ]
      .sort((a, b) => a.time - b.time)
      .reduce<PvpData["eloSeries"]>((list, point) => {
        const previous = list[list.length - 1];
        if (previous && previous.time === point.time) Object.assign(previous, point);
        else list.push({ ...point, h2h: h2hTimes.has(point.time) });
        return list;
      }, []);

    const decidingGames = games.filter((g) => g.sets.length === 3).length;
    const insights: string[] = [];
    if (games.length > 0) {
      const lastN = games.slice(-10);
      const p1Recent = lastN.filter((g) => g.p1Won).length;
      const recentLeader = p1Recent >= lastN.length / 2 ? p1 : p2;
      const recentWins = recentLeader === p1 ? p1Recent : lastN.length - p1Recent;
      insights.push(`${recentLeader.name} won ${recentWins} of the last ${lastN.length} games.`);
      if (currentStreak && currentStreak.length > 1) {
        const name = currentStreak.player === "p1" ? p1.name : p2.name;
        insights.push(`${name} has won the last ${currentStreak.length} games in a row.`);
      }
      if (decidingGames > 0) {
        const leader = p1.decidingWins >= p2.decidingWins ? p1 : p2;
        insights.push(`${leader.name} won ${leader.decidingWins} of ${decidingGames} games that went to a third set.`);
      }
      const closeSets = allSets.filter(isCloseSet).length;
      if (closeSets > 0) {
        const leader = p1.closeSetWins >= p2.closeSetWins ? p1 : p2;
        insights.push(`${leader.name} won ${leader.closeSetWins} of ${closeSets} close sets.`);
      }
    }

    return {
      p1,
      p2,
      games,
      scoredGames: games.filter((g) => g.sets.length > 0).length,
      decidingGames,
      closeSets: allSets.filter(isCloseSet).length,
      totalSets: allSets.length,
      currentStreak,
      prediction: context.predictions.getPredictedFraction(player1, player2),
      eloSeries,
      insights,
    };
  }, [context, player1, player2]);
}
