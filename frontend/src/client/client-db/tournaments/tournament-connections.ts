import { ONE_DAY } from "../../../common/time-in-ms";
import { TennisTable } from "../tennis-table";
import { Tournament, TournamentGame } from "./tournament";

/**
 * What a tournament does to the club beyond crowning a winner: it puts people in front of each
 * other who never meet on an ordinary day, and it pulls in people who were not playing at all.
 *
 * Everything is measured against the club as it stood the moment the tournament started. That one
 * baseline is what makes the numbers stable: a pair meeting twice inside the tournament (group play
 * and then the bracket) is still one first meeting, not a first meeting followed by a rematch.
 */

/** A pair, or a player, counts as away once this long has passed since they last played */
export const LONG_ABSENCE = 90 * ONE_DAY;

export type PairKind =
  /** These two had never played each other before */
  | "first-meeting"
  /** They had met, but not within LONG_ABSENCE of the tournament start */
  | "reunion"
  /** They play each other regularly enough that the tournament brought them nothing new */
  | "regular";

export type PairMeeting = {
  /** Stable identity, used as the react key */
  key: string;
  /** Sorted, so the pair reads the same no matter which side won */
  players: [string, string];
  kind: PairKind;
  /** Games the two played against each other inside the tournament */
  gamesInTournament: number;
  /** When they first met in the tournament */
  firstMetAt: number;
  /** Games between the two before the tournament started */
  gamesBefore: number;
  /** Their most recent game before the tournament. Undefined when they had never met */
  lastMetAt?: number;
  /** How long they had gone without meeting when the tournament started. Undefined for a first meeting */
  gap?: number;
  /** Games each of them had played in the club before the tournament, in the same order as `players` */
  experience: [number, number];
};

export type PlayerArrival = {
  playerId: string;
  /** They had never played a game in the club before this tournament started */
  debut: boolean;
  /** They had played before, but not within LONG_ABSENCE of the tournament start */
  returning: boolean;
  /**
   * They had played before but never in a tournament. Always false for a debut, where it would
   * only repeat what `debut` already says
   */
  firstTournament: boolean;
  gamesInTournament: number;
  /** Games they had played in the club before the tournament started */
  gamesBefore: number;
  /** Their most recent game before the tournament. Undefined for a debut */
  lastPlayedAt?: number;
  /** How long they had been away when the tournament started. Undefined for a debut */
  awayFor?: number;
};

export type TournamentConnections = {
  /** The club as it stood at this time is what everything is measured against */
  baseline: number;
  /** Every pair that played at least one real game in the tournament */
  pairs: PairMeeting[];
  firstMeetings: PairMeeting[];
  /** Longest time apart first */
  reunions: PairMeeting[];
  regulars: number;
  /**
   * The pair who had gone longest without meeting, even when that is short of LONG_ABSENCE. Lets
   * the widget still say something on a tournament of regulars. Undefined when every pair was new
   * to each other
   */
  longestGap?: PairMeeting;
  /** Only players the tournament brought something new to. Debuts first, then longest away */
  arrivals: PlayerArrival[];
  /** Players who played at least one real game in the tournament */
  playersPlayed: number;
  gamesPlayed: number;
};

type PlayedGame = { player1: string; player2: string; completedAt: number };

type History = { games: number; firstPlayedAt: number; lastPlayedAt: number };

function pairKey(player1: string, player2: string): string {
  return [player1, player2].sort().join("|");
}

/**
 * The games that were actually played at a table. Skipped games carry a winner and a completion
 * time like any other, but nobody met over them, and byes and walkovers never had two players
 */
function playedGames(tournament: Tournament): PlayedGame[] {
  const games: PlayedGame[] = [];
  const add = (game: Partial<TournamentGame>) => {
    if (game.skipped !== undefined) return;
    if (game.player1 === undefined || game.player2 === undefined || game.completedAt === undefined) return;
    games.push({ player1: game.player1, player2: game.player2, completedAt: game.completedAt });
  };
  tournament.groupPlay?.groups.forEach((group) => group.played.forEach(add));
  tournament.bracket?.getCompletedGames().forEach(add);
  return games.sort((a, b) => a.completedAt - b.completedAt);
}

/** Everyone who played a game in a tournament that had already started before this one */
function playersOfEarlierTournaments(tournament: Tournament, context: TennisTable): Set<string> {
  const players = new Set<string>();
  for (const other of context.tournaments.getTournaments()) {
    if (other.id === tournament.id) continue;
    if (other.startDate >= tournament.startDate) continue;
    for (const game of playedGames(other)) {
      players.add(game.player1);
      players.add(game.player2);
    }
  }
  return players;
}

/** Who had played whom, and how much, in the club before the tournament started */
function historyBefore(context: TennisTable, baseline: number): { players: Map<string, History>; pairs: Map<string, History> } {
  const players = new Map<string, History>();
  const pairs = new Map<string, History>();

  const record = (map: Map<string, History>, key: string, playedAt: number) => {
    const found = map.get(key);
    if (found === undefined) {
      map.set(key, { games: 1, firstPlayedAt: playedAt, lastPlayedAt: playedAt });
      return;
    }
    found.games++;
    found.lastPlayedAt = playedAt;
  };

  for (const game of context.games) {
    // The games getter hands them over oldest first, so the rest of them are all past the baseline
    if (game.playedAt >= baseline) break;
    record(players, game.winner, game.playedAt);
    record(players, game.loser, game.playedAt);
    record(pairs, pairKey(game.winner, game.loser), game.playedAt);
  }

  return { players, pairs };
}

export function buildTournamentConnections(
  tournament: Tournament,
  context: TennisTable,
): TournamentConnections | undefined {
  const games = playedGames(tournament);
  if (games.length === 0) return undefined; // Not started, or started and nobody has played yet

  const baseline = tournament.startDate;
  const history = historyBefore(context, baseline);

  // ---- Pairs ----

  type Met = { players: [string, string]; games: number; firstMetAt: number };
  const met = new Map<string, Met>();
  const participants = new Map<string, number>();

  for (const game of games) {
    const key = pairKey(game.player1, game.player2);
    const found = met.get(key);
    if (found === undefined) {
      // Sorted so the pair reads the same however the games went
      const players = [game.player1, game.player2].sort() as [string, string];
      met.set(key, { players, games: 1, firstMetAt: game.completedAt });
    } else {
      found.games++;
    }
    participants.set(game.player1, (participants.get(game.player1) ?? 0) + 1);
    participants.set(game.player2, (participants.get(game.player2) ?? 0) + 1);
  }

  const pairs: PairMeeting[] = Array.from(met, ([key, pair]) => {
    const before = history.pairs.get(key);
    const gap = before === undefined ? undefined : baseline - before.lastPlayedAt;
    const kind: PairKind = before === undefined ? "first-meeting" : gap! >= LONG_ABSENCE ? "reunion" : "regular";
    return {
      key,
      players: pair.players,
      kind,
      gamesInTournament: pair.games,
      firstMetAt: pair.firstMetAt,
      gamesBefore: before?.games ?? 0,
      lastMetAt: before?.lastPlayedAt,
      gap,
      experience: [
        history.players.get(pair.players[0])?.games ?? 0,
        history.players.get(pair.players[1])?.games ?? 0,
      ],
    };
  });

  // Two players with a long history who had still never met is the striking case, so the pair whose
  // less experienced half has played the most goes first
  const firstMeetings = pairs
    .filter((pair) => pair.kind === "first-meeting")
    .sort((a, b) => Math.min(...b.experience) - Math.min(...a.experience) || a.firstMetAt - b.firstMetAt);

  const reunions = pairs.filter((pair) => pair.kind === "reunion").sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));

  const longestGap = pairs
    .filter((pair) => pair.gap !== undefined)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];

  // ---- Players ----

  const earlierTournamentPlayers = playersOfEarlierTournaments(tournament, context);

  const arrivals: PlayerArrival[] = [];
  for (const [playerId, gamesInTournament] of participants) {
    const before = history.players.get(playerId);
    const debut = before === undefined;
    const returning = before !== undefined && baseline - before.lastPlayedAt >= LONG_ABSENCE;
    const firstTournament = !debut && !earlierTournamentPlayers.has(playerId);
    if (!debut && !returning && !firstTournament) continue; // The tournament was business as usual for them
    arrivals.push({
      playerId,
      debut,
      returning,
      firstTournament,
      gamesInTournament,
      gamesBefore: before?.games ?? 0,
      lastPlayedAt: before?.lastPlayedAt,
      awayFor: before === undefined ? undefined : baseline - before.lastPlayedAt,
    });
  }

  // Debuts first, then whoever had been away longest, then the first timers
  arrivals.sort((a, b) => {
    const rank = (arrival: PlayerArrival) => (arrival.debut ? 0 : arrival.returning ? 1 : 2);
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0);
  });

  return {
    baseline,
    pairs,
    firstMeetings,
    reunions,
    regulars: pairs.filter((pair) => pair.kind === "regular").length,
    longestGap,
    arrivals,
    playersPlayed: participants.size,
    gamesPlayed: games.length,
  };
}
