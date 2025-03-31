import { Tournament, TournamentGame } from "./tournament";

type GroupGame = Omit<TournamentGame, "advanceTo">;
type GroupScore = Map<string, GroupScorePlayer>;
export type GroupScorePlayer = {
  name: string;
  score: number;
  adjustedScore: number;
  groupSizeAdjustmentFactor: number;
  wins: number;
  loss: number;
  dnf: number;
  playerOrderIndex: number;
};

export class TournamentGroupPlay {
  readonly #tournament: Tournament;
  readonly playerOrder: string[];

  groups: {
    players: string[];
    played: GroupGame[];
    pending: Partial<GroupGame>[];
    groupGames: Partial<GroupGame>[];
  }[];
  groupScores: GroupScore;
  groupPlayEnded?: number;

  constructor(tournament: Tournament) {
    this.#tournament = tournament;
    this.playerOrder = this.#tournament.tournamentDb.playerOrder ?? tournament.signedUp.map((s) => s.player);

    const groups = this.#divideInGroups(this.playerOrder);
    const groupGames = this.#generateGroupGames(groups);
    this.#fillGroupsWithGames(groupGames);
    this.groupScores = this.#calculateGroupScores(groups, groupGames);
    this.groupPlayEnded = this.#findGroupPlayEndedAt(groupGames);
    this.groups = groups.map((players, groupIndex) => ({
      players,
      groupGames: groupGames[groupIndex],
      played: groupGames[groupIndex].filter((g) => !!g.completedAt) as GroupGame[],
      pending: groupGames[groupIndex].filter((g) => !g.completedAt),
    }));
  }

  getBracketPlayerOrder(): string[] | undefined {
    return Array.from(this.groupScores)
      .sort(TournamentGroupPlay.sortGroupScores) // Sort by score
      .map((player) => player[0]) // Only get the name
      .slice(0, Math.pow(2, Math.floor(Math.log2(this.playerOrder.length)))); // Slice to biggest full power of 2
  }

  getBracketSize(): number {
    return Math.pow(2, Math.floor(Math.log2(this.playerOrder.length)));
  }

  #divideInGroups(players: string[]): string[][] {
    const groupSizes = this.#getGroupSizes(players.length);
    const groups: string[][] = [];
    for (let i = 0; i < groupSizes.length; ++i) groups[i] = [];

    // We can safely distribute this number of players in each group first
    const lowestGroupSize = Math.min(...groupSizes);

    let assignedPlayers = 0;
    let lastAssignedTopPlayer = -1;
    let lastAssignedBottomPlayer = players.length;

    // Fill the groups with an even number of players between the groups
    for (let lowestGroupSizeIndex = 0; lowestGroupSizeIndex < lowestGroupSize; lowestGroupSizeIndex++) {
      const fillFromBottom = lowestGroupSizeIndex % 2 === 0;
      const fillFromStart = Math.floor(lowestGroupSizeIndex / 2) % 2 === 0;
      for (let i = 0; i < groups.length; i++) {
        const playerToAssignIndex = fillFromBottom ? lastAssignedBottomPlayer - 1 : lastAssignedTopPlayer + 1;
        const groupToAssignToIndex = fillFromStart ? i : groups.length - 1 - i;
        groups[groupToAssignToIndex].push(players[playerToAssignIndex]);
        if (fillFromBottom) {
          lastAssignedBottomPlayer--;
        } else {
          lastAssignedTopPlayer++;
        }
        assignedPlayers++;
      }
    }

    const remainingPlayers = players.length - assignedPlayers;

    // Fill the rest of the players in the groups
    const fillFromStart = Math.floor((lowestGroupSize - 1) / 2) % 2 === 1;
    for (let i = 0; i < remainingPlayers; i++) {
      const playerToAssignIndex = lastAssignedBottomPlayer - 1;
      const groupToAssignToIndex = fillFromStart ? i : groups.length - 1 - i;
      groups[groupToAssignToIndex].push(players[playerToAssignIndex]);
      lastAssignedBottomPlayer--;
      assignedPlayers++;
    }

    for (const group of groups) {
      // Sort players by their order in the tournament
      group.sort((a, b) => players.findIndex((n) => n === a) - players.findIndex((n) => n === b));
    }
    return groups;
  }

  #getGroupSizes(players: number): number[] {
    if (players === 24) return [5, 5, 5, 5, 4]; // Special case

    function getPreferredGroupSize(players: number): number {
      if (players <= 8) return 3;
      if (players === 11) return 3; // 4, 4, 3 instead of 6, 5
      if (players <= 19) return 4;
      if (players >= 21 && players <= 23) return 4;
      return 5;
    }
    const groupSize = getPreferredGroupSize(players);
    const fullGroups = Math.floor(players / groupSize);
    const restPlayers = players % groupSize;

    if (fullGroups === 0) {
      return [restPlayers];
    }

    const groups = new Array(fullGroups).fill(groupSize);
    for (let i = 0; i < restPlayers; i++) {
      groups[i % groups.length]++;
    }
    return groups;
  }

  #generateGroupGames(groups: string[][]): Partial<GroupGame>[][] {
    const groupGames: Partial<GroupGame>[][] = [];
    for (let i = 0; i < groups.length; ++i) groupGames[i] = [];

    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
      for (let playerIndex = 0; playerIndex < groups[groupIndex].length - 1; playerIndex++) {
        for (let oponentIndex = playerIndex + 1; oponentIndex < groups[groupIndex].length; oponentIndex++) {
          groupGames[groupIndex].push({
            player1: groups[groupIndex][playerIndex],
            player2: groups[groupIndex][oponentIndex],
          });
        }
      }
    }
    return groupGames;
  }

  #fillGroupsWithGames(groupGames: Partial<GroupGame>[][]): void {
    const entries = this.#tournament.getRelevantGames(this.#tournament.tournamentDb.startDate);
    entries.forEach((entry) => {
      const entryPlayers = [entry.player1, entry.player2];
      const matchedGroup = groupGames.findIndex((group) =>
        group.some(
          (game) => !game.completedAt && entryPlayers.includes(game.player1!) && entryPlayers.includes(game.player2!),
        ),
      );

      if (matchedGroup === -1) return;
      const matchedGame = groupGames[matchedGroup].findIndex(
        (game) => !game.completedAt && entryPlayers.includes(game.player1!) && entryPlayers.includes(game.player2!),
      )!;
      if (entry.game) {
        groupGames[matchedGroup][matchedGame].winner = entry.game.winner;
        groupGames[matchedGroup][matchedGame].completedAt = entry.game.playedAt;
      } else {
        groupGames[matchedGroup][matchedGame].skipped = entry.skip;
        groupGames[matchedGroup][matchedGame].winner = entry.skip.advancing;
        groupGames[matchedGroup][matchedGame].completedAt = entry.skip.time;
      }
    });
  }

  #calculateGroupScores(groups: string[][], groupGames: Partial<GroupGame>[][]): GroupScore {
    const biggestGroup = groups.reduce((biggest, group) => (biggest = Math.max(group.length, biggest)), 0);
    const scores: GroupScore = new Map();
    groups.forEach((group) =>
      group.forEach((player) =>
        scores.set(player, {
          name: player,
          score: 0,
          adjustedScore: 0,
          groupSizeAdjustmentFactor: (biggestGroup - 1) / (group.length - 1),
          wins: 0,
          loss: 0,
          dnf: 0,
          playerOrderIndex: this.playerOrder.findIndex((p) => p === player),
        }),
      ),
    );

    groupGames.forEach((group) =>
      group.forEach((game) => {
        if (game.winner === undefined) return;
        // Winner
        const winner = scores.get(game.winner)!;
        winner.wins++;
        winner.score += Tournament.GROUP_POINTS.WIN;
        winner.adjustedScore += Tournament.GROUP_POINTS.WIN * winner.groupSizeAdjustmentFactor;

        // Loser
        const loserName = [game.player1!, game.player2!].filter((player) => player !== game.winner)[0];
        const loser = scores.get(loserName)!;
        if (game.skipped) {
          loser.dnf++;
          loser.score += Tournament.GROUP_POINTS.SKIP;
          loser.adjustedScore += Tournament.GROUP_POINTS.SKIP * loser.groupSizeAdjustmentFactor;
        } else {
          loser.loss++;
          loser.score += Tournament.GROUP_POINTS.LOSS;
          loser.adjustedScore += Tournament.GROUP_POINTS.LOSS * loser.groupSizeAdjustmentFactor;
        }
      }),
    );
    return scores;
  }

  #findGroupPlayEndedAt(groupGames: Partial<GroupGame>[][]): number | undefined {
    const allGamesPlayed = groupGames.every((group) => group.every((game) => !!game.winner));
    if (allGamesPlayed === false) return undefined;
    return groupGames.reduce(
      (latestGameInGroup, group) =>
        Math.max(
          latestGameInGroup,
          group.reduce((latestGame, game) => Math.max(latestGame, game.completedAt ?? 0), 0),
        ),
      0,
    );
  }

  static sortGroupScores([_, p1]: [string, GroupScorePlayer], [__, p2]: [string, GroupScorePlayer]): number {
    if (p1.adjustedScore !== p2.adjustedScore) {
      return p2.adjustedScore - p1.adjustedScore;
    }
    if (p1.wins !== p2.wins) {
      return p2.wins - p1.wins;
    }
    if (p1.dnf !== p2.dnf) {
      return p1.dnf - p2.dnf; // Reversed because fewer dnf is better
    }
    if (p1.loss !== p2.loss) {
      return p1.loss - p2.loss; // Reversed because fewer loss is better
    }
    if (p1.score !== p2.score) {
      return p2.score - p1.score;
    }

    return p1.playerOrderIndex - p2.playerOrderIndex; // Default to player order
  }
}
