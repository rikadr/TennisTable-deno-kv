import { Game, SignUpTournament, TournamentDB } from "./types";

export type TournamentGame = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: TournamentDB["skippedGames"][number];
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: { layerIndex: number; gameIndex: number; role: "player1" | "player2" };
};

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

type Bracket = Partial<TournamentGame>[][];
type GroupGame = Omit<TournamentGame, "advanceTo">;
type GroupScore = Map<string, GroupScorePlayer>;

export class Tournament {
  readonly tournamentDb: TournamentDB;
  readonly #games: Game[];
  readonly signedUp: SignUpTournament[];
  groupPlay?: TournamentGroupPlay;
  bracket?: TournamentBracket;

  static GROUP_POINTS = { WIN: 3, LOSS: 1, DNF: 1 } as const;

  constructor(tournamentDb: TournamentDB, games: Game[], signedUp: SignUpTournament[]) {
    this.tournamentDb = tournamentDb;
    this.#games = games;
    this.signedUp = signedUp;

    if (this.tournamentDb.startDate > Date.now()) {
      return; // Not started. No need to calculate bracket or group play
    }
    if (this.tournamentDb.groupPlay) {
      this.groupPlay = new TournamentGroupPlay(this, games);
    }
    if (
      this.tournamentDb.groupPlay === false || // No group play
      this.groupPlay === undefined || // Group play is not calculated
      this.groupPlay.groupPlayEnded !== undefined // Group play has ended
    ) {
      this.bracket = new TournamentBracket(this, games);
    }
  }

  get id() {
    return this.tournamentDb.id;
  }
  get name() {
    return this.tournamentDb.name;
  }
  get description() {
    return this.tournamentDb.description;
  }
  get startDate() {
    return this.tournamentDb.startDate;
  }
  get endDate() {
    return this.bracket?.bracketEnded;
  }
  get winner() {
    return this.bracket?.winner;
  }

  /** Used by bracket and group play to get the relevant games and skips */
  getRelevantGames(startTime: number) {
    type BaseEntry = { time: number; player1: string; player2: string };
    const entries: (
      | (BaseEntry & { game: Game; skip: undefined })
      | (BaseEntry & { game: undefined; skip: TournamentDB["skippedGames"][number] })
    )[] = [];

    this.#games
      .filter((game) => game?.time > startTime)
      .forEach((game) =>
        entries.push({ time: game.time, player1: game.winner, player2: game.loser, game, skip: undefined }),
      );

    this.tournamentDb.skippedGames
      .filter((s) => s.time > startTime)
      .forEach((skip) =>
        entries.push({ time: skip.time, player1: skip.advancing, player2: skip.eliminated, game: undefined, skip }),
      );

    entries.sort((a, b) => a.time - b.time); // Might be heavy sorting, but we need to be sure the games are in order
    return entries;
  }
}

export class TournamentGroupPlay {
  readonly #tournament: Tournament;
  readonly playerOrder: string[];

  groups: {
    players: string[];
    played: GroupGame[];
    pending: GroupGame[];
    groupGames: Partial<GroupGame>[];
  }[];
  groupScores: GroupScore;
  groupPlayEnded?: number;

  constructor(tournament: Tournament, games: Game[]) {
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
      pending: groupGames[groupIndex].filter((g) => !g.completedAt) as GroupGame[],
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

    let assignedPlayers = 0;
    let lastAssignedTopPlayer = -1;
    let lastAssignedBottomPlayer = players.length;

    while (assignedPlayers < players.length) {
      for (let i = 0; i < groups.length; i++) {
        const worstRemainingPlayer = players[lastAssignedBottomPlayer - 1];
        if (worstRemainingPlayer && groups[i].length < groupSizes[i]) {
          // Only adds if room in group
          groups[i].push(worstRemainingPlayer);
          lastAssignedBottomPlayer--;
          assignedPlayers++;
        }
        const bestRemainingPlayer = players[lastAssignedTopPlayer + 1];
        if (bestRemainingPlayer && groups[i].length < groupSizes[i]) {
          // Only adds if room in group
          groups[i].push(bestRemainingPlayer);
          lastAssignedTopPlayer++;
          assignedPlayers++;
        }
      }
    }

    for (const group of groups) {
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
        groupGames[matchedGroup][matchedGame].completedAt = entry.game.time;
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
          loser.score += Tournament.GROUP_POINTS.DNF;
          loser.adjustedScore += Tournament.GROUP_POINTS.DNF * loser.groupSizeAdjustmentFactor;
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

export class TournamentBracket {
  readonly #tournament: Tournament;
  readonly #playerOrder: string[];

  bracket: Bracket;
  bracketGames: {
    // Games per layer
    played: TournamentGame[];
    pending: TournamentGame[]; // Games that can be played now
  }[];
  bracketStarted: number;
  bracketEnded?: number; // TODO: Fill in. this is not in the old file

  constructor(tournament: Tournament, games: Game[]) {
    // Assumes no group play, or that group play has ended
    this.#tournament = tournament;
    if (this.#tournament.groupPlay?.groupPlayEnded !== undefined) {
      this.#playerOrder = this.#tournament.groupPlay.getBracketPlayerOrder() ?? [];
      this.bracketStarted = this.#tournament.groupPlay.groupPlayEnded;
    } else {
      this.#playerOrder = this.#tournament.tournamentDb.playerOrder ?? tournament.signedUp.map((s) => s.player);
      this.bracketStarted = this.#tournament.tournamentDb.startDate;
    }

    this.bracket = this.#getStartingBracket();
    this.#fillBracketWithGames();
    this.bracketGames = this.#calculateBracketGames();
  }

  get winner() {
    return this.bracket[0][0]?.winner;
  }

  #getStartingBracket(): Bracket {
    const bracket: Bracket = [];

    this.#playerOrder.forEach((player, playerIndex, players) => {
      const layerIndex = Math.floor(Math.log2(Math.max(1, playerIndex)));
      const gamesInLayer = Math.pow(2, layerIndex);

      // Fill layer with empty games
      if (bracket[layerIndex] === undefined) {
        bracket[layerIndex] = Array.from({ length: gamesInLayer }, (_, index) => {
          if (layerIndex === 0) {
            return {}; // The Final game
          } else {
            return {
              advanceTo: {
                layerIndex: layerIndex - 1,
                gameIndex: Math.floor(index / 2),
                role: index % 2 === 0 ? "player1" : "player2",
              },
            };
          }
        });
      }

      // Assign players to the final game
      if (playerIndex < 2) {
        bracket[layerIndex][0][playerIndex === 0 ? "player1" : "player2"] = player;
        return; // Can i return here?
      }
      const oponentIndex = 2 * gamesInLayer - 1 - playerIndex;
      const oponent = players[oponentIndex];
      if (oponent === undefined) throw new Error("oponent is undefined");

      const oponentsMatchIndex = bracket[layerIndex - 1].findIndex(({ player1, player2 }) =>
        [player1, player2].includes(oponent),
      );
      if (oponentsMatchIndex === -1) throw new Error("oponentsMatchIndex not found (-1)");
      const oponentsMatch = bracket[layerIndex - 1][oponentsMatchIndex];
      const oponentRole: keyof TournamentGame = oponentsMatch.player1 === oponent ? "player1" : "player2";

      const newGameIndex = oponentsMatchIndex * 2 + (oponentRole === "player1" ? 0 : 1);
      const newGame = bracket[layerIndex][newGameIndex];

      // Add players to new game
      newGame.player1 = oponent;
      newGame.player2 = player;

      // Remove oponent from oponent game
      oponentsMatch[oponentRole] = undefined;
    });

    return bracket;
  }

  #fillBracketWithGames() {
    const entries = this.#tournament.getRelevantGames(this.bracketStarted);

    entries.forEach((entry) => {
      // eslint-disable-next-line no-loop-func
      this.bracket.forEach((layer, layerIndex) =>
        layer.forEach((match) => {
          if (match.winner || match.player1 === undefined || match.player2 === undefined) {
            // Won (or skipped), or incomplete players
            return;
          }
          const matchPlayers = [match.player1, match.player2];
          const entryPlayers = [entry.player1, entry.player2];
          const entryIsMatch = matchPlayers.every((player) => entryPlayers.includes(player));

          if (entryIsMatch === false) {
            // No match, keep as pending
            return;
          }

          match.winner = entry.game ? entry.game.winner : entry.skip.advancing;
          match.completedAt = entry.time; // Not sure how that would affect select item options for skipped games.....
          match.skipped = entry.skip;

          if (layerIndex === 0) {
            // No advanceTo for the final game
            return;
          }

          if (match.advanceTo === undefined) throw new Error("AdvanceTo not defined");
          const nextMatch = this.bracket[match.advanceTo.layerIndex][match.advanceTo.gameIndex];
          if (!nextMatch) throw new Error("Next match does not exist");
          if (nextMatch.player1 && nextMatch.player2) throw new Error("Next match already full");
          nextMatch[match.advanceTo.role] = match.winner;
        }),
      );
    });
  }

  #calculateBracketGames() {
    const games: TournamentBracket["bracketGames"] = [];
    for (let layerIndex = 0; layerIndex < this.bracket.length; layerIndex++) {
      const played: TournamentGame[] = [];
      const pending: TournamentGame[] = [];
      const layer = this.bracket[layerIndex];

      for (const game of layer) {
        if (game.player1 && game.player2) {
          // Both player are set
          if (game.winner || game.skipped) {
            // Game is completed
            played.push(game as TournamentGame);
          } else {
            // Game is pending
            pending.push(game as TournamentGame);
          }
        }
      }
      games.push({ pending, played });
    }
    return games;
  }
}
