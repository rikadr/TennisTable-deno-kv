import { TennisTable } from "./tennis-table";

export type PairedPlayer = {
  playerId: string;
  /** Games played on the last hop of the shortest path. For degree 1 that is games against the player themselves. */
  games: number;
  /** The path from the player to this player, excluding the player itself. Last entry is `playerId`. */
  path: string[];
};

export type PlayerPairingsColumn = {
  /** 1 = played each other, 2 = one intermediary, 3 = two intermediaries, ... */
  degree: number;
  players: PairedPlayer[];
};

export type PlayerPairingsDTO = {
  columns: PlayerPairingsColumn[];
  /** Included players with no path of games connecting them to the player. */
  unreachable: string[];
};

export type PlayerPairingsOptions = {
  /** Let retired players be reached, and be routed through. Defaults to false. */
  includeRetired?: boolean;
  /** Games two players need against each other before that counts as a link. Defaults to 1. */
  minGamesPerLink?: number;
};

/**
 * Groups every other player by how many intermediaries it takes to connect them to a player
 * through games played. Retired players are left out of the graph by default, so retiring a
 * player breaks the paths that ran through them.
 */
export class PlayerPairings {
  private parent: TennisTable;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  get(playerId: string, options: PlayerPairingsOptions = {}): PlayerPairingsDTO {
    const includeRetired = options.includeRetired ?? false;
    const minGamesPerLink = Math.max(1, options.minGamesPerLink ?? 1);

    const included = includeRetired ? this.parent.allPlayers : this.parent.players;
    // The player themselves may be retired, but their own games still connect them to the graph.
    const nodes = new Set<string>(included.map((player) => player.id));
    nodes.add(playerId);

    const games = new Map<string, Map<string, number>>();
    const addGame = (from: string, to: string) => {
      const opponents = games.get(from) ?? new Map<string, number>();
      opponents.set(to, (opponents.get(to) ?? 0) + 1);
      games.set(from, opponents);
    };
    for (const { winner, loser } of this.parent.games) {
      if (winner === loser || !nodes.has(winner) || !nodes.has(loser)) continue;
      addGame(winner, loser);
      addGame(loser, winner);
    }

    const degrees = new Map<string, number>([[playerId, 0]]);
    const columns: PlayerPairingsColumn[] = [];

    let previous: PairedPlayer[] = [{ playerId, games: 0, path: [] }];
    while (previous.length > 0) {
      const degree = columns.length + 1;
      const found = new Map<string, PairedPlayer>();

      for (const from of previous) {
        for (const [to, gamesPlayed] of games.get(from.playerId) ?? []) {
          if (gamesPlayed < minGamesPerLink) continue; // Too few games together to count as a link
          if (degrees.has(to)) continue; // Already reached on a shorter path
          const existing = found.get(to);
          // Multiple paths of the same length: keep the one with the most games on the last hop.
          if (existing && existing.games >= gamesPlayed) continue;
          found.set(to, { playerId: to, games: gamesPlayed, path: [...from.path, to] });
        }
      }

      for (const foundId of found.keys()) {
        degrees.set(foundId, degree);
      }

      previous = Array.from(found.values()).sort(
        (a, b) =>
          b.games - a.games ||
          this.parent.playerName(a.playerId).localeCompare(this.parent.playerName(b.playerId)),
      );
      if (previous.length > 0) {
        columns.push({ degree, players: previous });
      }
    }

    const unreachable = included
      .filter((player) => !degrees.has(player.id))
      .map((player) => player.id)
      .sort((a, b) => this.parent.playerName(a).localeCompare(this.parent.playerName(b)));

    return { columns, unreachable };
  }
}
