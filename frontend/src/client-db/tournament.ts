import { TennisTable } from "./tennis-table";
import { Game, TournamentDB } from "./types";

export type TournamentGame = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: TournamentDB["skippedGames"][number];
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: { layerIndex: number; gameIndex: number; role: "player1" | "player2" };
};

type GroupGame = Omit<TournamentGame, "advanceTo">;
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
type GroupScore = Map<string, GroupScorePlayer>;

export type TournamentWithGames = TournamentDB & {
  bracketGames?: {
    // Games per layer
    played: TournamentGame[]; // Games that have been played
    pending: TournamentGame[]; // Games that can be played now
  }[];
  bracket?: Bracket;
  groups?: {
    players: string[];
    // groupEnded?: number;
    played: GroupGame[];
    pending: GroupGame[];
    groupGames: Partial<GroupGame>[];
  }[];
  groupPlayEnded?: number;
  groupScores?: GroupScore;
};

type Bracket = Partial<TournamentGame>[][];

export const optioEasterTournament: TournamentDB = {
  id: "randomid38",
  // name: "Optio Easter Tournament 2025 🐣💛",
  name: "Test group play tournament",
  description: "This is a test tournament just to try out the group play feature",
  startDate: 1740600238644,
  groupPlay: true,
  signedUp: [],
  skippedGames: [],
  playerOrder: [
    "Rasmus",
    "Fooa",
    "Alexander",
    "Peder",
    "Simone",
    "Christoffer",
    "Oskar",
    "Daniel",
    "Erling",
    "Rikard",
    "Sveinung",
    "Fredrik H",
    "Axel",
    "Ole",
    "Marius",
    "Anders",
    "Gustas",
    "Vlad",
    "Ole Anders",
    "Bendik",
    // "Daniele",
    // "Kevin",
    // "James 007",
    // "Chakib Youcefi",
    // "Test name 1",
    // "Test name 2",
    // "Test name 3",
    // "Test name 4",
    // "Test name 5",
    // "Test name 6",
    // "Test name 7",
    // "Test name 8",
    // "Test name 9",
    // "Test name 10",
    // "Test name 11",
    // "Test name 12",
    // "Test name 13",
    // "Test name 14",
    // "Test name 15",
    // "Test name 16",
    // "Test name 17",
    // "Test name 18",
    // "Test name 19",
    // "Test name 20",
    // "Test name 21",
    // "Test name 22",
    // "Test name 23",
    // "Test name 24",
    // "Test name 25",
    // "Test name 26",
    // "Test name 27",
    // "Test name 28",
    // "Test name 29",
    // "Test name 30",
    // "Test name 31",
    // "Test name 32",
    // "Test name 33",
    // "Test name 34",
    // "Test name 35",
    // "Test name 36",
    // "Test name 37",
  ],
};

export const optioChristmasTournament: TournamentDB = {
  id: "randomid37",
  name: "Optio Christmas Tournament 2024 🏓🎅🏻",
  description:
    "The social happening of the year, and a long awaited feature!! Sign up with your player and join the tournament 🚀",
  startDate: 1732613408196, // Nov 26 2024 10:30:08 GMT+0100
  groupPlay: false,
  signedUp: [],
  skippedGames: [{ advancing: "Marius", eliminated: "Erling", time: 1732709055829 }],

  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Rasmus",
    "Simone",
    "Alexander",
    "Fooa",
    "Peder",
    "Erling",
    "Oskar",
    "Fredrik H",
    "Rikard",
    "Ole",
    "Marius",
    "Gina",
    "Gustas",
    "Daniele",
    "Ole Anders",
    "Kevin",
    "James 007",
    "Chakib Youcefi",
  ],
};

export const mockTournament2: TournamentDB = {
  id: "2",
  name: "Test big numbers",
  description: "Dette er en testturnering for å teste ut funksjonalitet i TennisTable",

  startDate: 1731524875192, // 13th nov, 20:08
  // startDate: 0,
  groupPlay: false,
  signedUp: [],
  skippedGames: [],

  // TODO: function to set playerOrder based on elo at the time. if some players are not ranked, order them last by theirs signup order
  playerOrder: [
    "Rasmus",
    "Simone",
    "Alexander",
    "Fooa",
    "Peder",
    "Christoffer",
    "Erling",
    "Oskar",
    "Sveinung",
    "Fredrik H",
    "Axel",
    "Rikard",
    "Anders",
    "Ole",
    "Marius",
    "Tor",
    "Ole Anders",
    "Markus",
    "Yngve",
    "Test name 1",
    "Test name 2",
    "Test name 3",
    "Test name 4",
    "Test name 5",
    "Test name 6",
    "Test name 7",
    "Test name 8",
    "Test name 9",
    "Test name 10",
    "Test name 11",
    "Test name 12",
    "Test name 13",
    "Test name 14",
    "Test name 15",
    "Test name 16",
    "Test name 17",
    "Test name 18",
    "Test name 19",
    "Test name 20",
    "Test name 21",
    "Test name 22",
    "Test name 23",
    "Test name 24",
    "Test name 25",
    "Test name 26",
    "Test name 27",
    "Test name 28",
    "Test name 29",
    "Test name 30",
    "Test name 31",
    "Test name 32",
    "Test name 33",
    "Test name 34",
    "Test name 35",
    "Test name 36",
    "Test name 37",
    "Test name 38",
    "Test name 39",
    "Test name 40",
    "Test name 41",
    "Test name 42",
    "Test name 43",
    "Test name 44",
    "Test name 45",
    "Test name 46",
    "Test name 47",
    "Test name 48",
    "Test name 49",
    "Test name 50",
    "Test name 51",
    "Test name 52",
    "Test name 53",
    "Test name 54",
    "Test name 55",
    "Test name 56",
    "Test name 57",
    "Test name 58",
    "Test name 59",
    "Test name 60",
    "Test name 61",
    "Test name 62",
    "Test name 63",
    "Test name 64",
    "Test name 65",
    "Test name 66",
    "Test name 67",
    "Test name 68",
    "Test name 69",
    "Test name 70",
    "Test name 71",
    "Test name 72",
    "Test name 73",
    "Test name 74",
    "Test name 75",
    "Test name 76",
    "Test name 77",
    "Test name 78",
    // "Test name 79",
    // "Test name 80",
    // "Test name 81",
    // "Test name 82",
    // "Test name 83",
    // "Test name 84",
    // "Test name 85",
    // "Test name 86",
    // "Test name 87",
    // "Test name 88",
    // "Test name 89",
    // "Test name 90",
    // "Test name 91",
    // "Test name 92",
    // "Test name 93",
    // "Test name 94",
    // "Test name 95",
    // "Test name 96",
    // "Test name 97",
    // "Test name 98",
    // "Test name 99",
    // "Test name 100",
    // "Test name 101",
    // "Test name 102",
    // "Test name 103",
    // "Test name 104",
    // "Test name 105",
    // "Test name 106",
    // "Test name 107",
    // "Test name 108",
    // "Test name 109",
    // "Test name 110",
    // "Test name 111",
    // "Test name 112",
    // "Test name 113",
    // "Test name 114",
    // "Test name 115",
    // "Test name 116",
    // "Test name 117",
    // "Test name 118",
    // "Test name 119",
    // "Test name 120",
    // "Test name 121",
    // "Test name 122",
    // "Test name 123",
    // "Test name 124",
    // "Test name 125",
    // "Test name 126",
    // "Test name 127",
    // "Test name 128",
    // "Test name 129",
    // "Test name 130",
    // "Test name 131",
    // "Test name 132",
    // "Test name 133",
    // "Test name 134",
    // "Test name 135",
    // "Test name 136",
    // "Test name 137",
    // "Test name 138",
    // "Test name 139",
    // "Test name 140",
    // "Test name 141",
    // "Test name 142",
    // "Test name 143",
    // "Test name 144",
    // "Test name 145",
    // "Test name 146",
    // "Test name 147",
    // "Test name 148",
    // "Test name 149",
    // "Test name 150",
    // "Test name 151",
    // "Test name 152",
    // "Test name 153",
    // "Test name 154",
    // "Test name 155",
    // "Test name 156",
    // "Test name 157",
    // "Test name 158",
    // "Test name 159",
    // "Test name 160",
    // "Test name 161",
    // "Test name 162",
    // "Test name 163",
    // "Test name 164",
    // "Test name 165",
    // "Test name 166",
    // "Test name 167",
    // "Test name 168",
    // "Test name 169",
    // "Test name 170",
    // "Test name 171",
    // "Test name 172",
    // "Test name 173",
    // "Test name 174",
    // "Test name 175",
    // "Test name 176",
    // "Test name 177",
    // "Test name 178",
    // "Test name 179",
    // "Test name 180",
    // "Test name 181",
    // "Test name 182",
    // "Test name 183",
    // "Test name 184",
    // "Test name 185",
    // "Test name 186",
    // "Test name 187",
    // "Test name 188",
    // "Test name 189",
    // "Test name 190",
    // "Test name 191",
    // "Test name 192",
    // "Test name 193",
    // "Test name 194",
    // "Test name 195",
    // "Test name 196",
    // "Test name 197",
    // "Test name 198",
    // "Test name 199",
    // "Test name 200",
  ],
};

export class Tournaments {
  private parent: TennisTable;
  tournaments: TournamentDB[] = [optioChristmasTournament, optioEasterTournament]; // Add mock for mock data -> mockTournament1, mockTournament2
  private skipIsEnabled = true; // False for prod

  static GROUP_POINTS = { WIN: 3, LOSS: 1, DNF: 1 } as const;

  #tournamentsCache: TournamentWithGames[] | undefined;

  constructor(parent: TennisTable) {
    this.parent = parent;
  }

  getTournaments(): TournamentWithGames[] {
    if (this.#tournamentsCache !== undefined) return this.#tournamentsCache;
    const tournaments = this.#getTournaments();
    this.#tournamentsCache = tournaments;
    return tournaments;
  }

  #getTournaments(): TournamentWithGames[] {
    return this.tournaments.map((t) => this.getTournament(t));
  }

  getTournament(t: TournamentDB): TournamentWithGames {
    const signedUp = this.parent.signedUp.filter((s) => s.tournamentId === t.id).sort((a, b) => a.time - b.time);

    if (t.startDate > Date.now()) {
      return {
        ...t,
        signedUp,
      };
    }

    let tournamentStart = t.startDate;
    let tournamentPlayerOrder = t.playerOrder;
    let groupsCalculated: TournamentWithGames["groups"] = undefined;
    let groupPlayEndedAt: number | undefined = undefined;
    let groupScores: GroupScore | undefined = undefined;

    if (t.groupPlay === true) {
      const groups = this.#divideInGroups(t.playerOrder || []);
      const groupGames = this.#generateGroupGames(groups);
      this.#fillGroupsWithGames(groupGames, t.startDate, t.skippedGames);
      groupScores = this.#getGroupScores(groups, groupGames, tournamentPlayerOrder || []);
      groupPlayEndedAt = this.#findGroupPlayEndedAt(groupGames);

      if (groupPlayEndedAt === undefined) {
        return {
          ...t,
          signedUp,
          groups: groups.map((players, groupIndex) => ({
            players,
            groupGames: groupGames[groupIndex],
            played: groupGames[groupIndex].filter((g) => !!g.completedAt) as GroupGame[],
            pending: groupGames[groupIndex].filter((g) => !g.completedAt) as GroupGame[],
          })),
          groupScores,
        };
      }

      tournamentStart = groupPlayEndedAt + 1;
      tournamentPlayerOrder = Array.from(groupScores)
        .sort(Tournaments.sortGroupScores) // Sort by score
        .map((player) => player[0]) // Only get the name
        .slice(0, Math.pow(2, Math.floor(Math.log2((t.playerOrder || []).length)))); // Slice to biggest full power of 2
      groupsCalculated = groups.map((players, groupIndex) => ({
        players,
        groupGames: groupGames[groupIndex],
        played: groupGames[groupIndex] as GroupGame[],
        pending: [],
      }));
    }

    // Tournament has started
    const bracket = this.#getStartingBracketFromPlayerOrder(tournamentPlayerOrder || []);
    this.#fillBracketWithGames(bracket, tournamentStart, t.skippedGames);

    const games: TournamentWithGames["bracketGames"] = [];

    for (let layerIndex = 0; layerIndex < bracket.length; layerIndex++) {
      const played: TournamentGame[] = [];
      const pending: TournamentGame[] = [];
      const layer = bracket[layerIndex];

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

    return {
      ...t,
      signedUp,
      bracketGames: games,
      bracket,
      groups: groupsCalculated,
      groupPlayEnded: groupPlayEndedAt,
      groupScores,
    };
  }

  skipGame(skip: TournamentDB["skippedGames"][number], tournamentId: string) {
    if (this.skipIsEnabled === false) {
      window.alert("Ask Rikard to skip the game 🙏 It's not self serviced yet... "); // TODO: Make self serviced
      return;
    }
    const tournamentIndex = this.tournaments.findIndex((t) => t.id === tournamentId);
    this.tournaments[tournamentIndex]?.skippedGames.push(skip);
    this.#tournamentsCache = undefined;
  }

  undoSkipGame(skip: TournamentDB["skippedGames"][number], tournamentId: string) {
    if (this.skipIsEnabled === false) {
      window.alert("Ask Rikard to undo the skip 🙏 It's not self serviced yet... "); // TODO: Make self serviced
      return;
    }
    const tournamentIndex = this.tournaments.findIndex((t) => t.id === tournamentId);
    if (tournamentIndex !== -1) {
      this.tournaments[tournamentIndex].skippedGames = this.tournaments[tournamentIndex].skippedGames.filter(
        (game) => game.time !== skip.time,
      );
    }
    this.#tournamentsCache = undefined;
  }

  isPendingGame(
    // Needs update on group play
    player1: string | null | undefined,
    player2: string | null | undefined,
  ):
    | {
        tournament: { name: string; id: string };
        layerIndex: number;
        game: { player1: string; player2: string };
      }
    | undefined {
    if (!player1 || !player2) return;
    const players = [player1, player2];

    const tournament = this.getTournaments().find((t) =>
      t.bracketGames?.some((layer) =>
        layer.pending.some((game) => players.includes(game.player1) && players.includes(game.player2)),
      ),
    );
    if (!tournament || !tournament.bracketGames) return; // remove || !tournament.bracketGames

    const layerIndex = tournament.bracketGames.findIndex((layer) =>
      layer.pending.some((game) => players.includes(game.player1) && players.includes(game.player2)),
    );
    if (layerIndex === -1) return;

    const game = tournament.bracketGames![layerIndex].pending?.find(
      (game) => players.includes(game.player1) && players.includes(game.player2),
    );
    if (!game) return;

    return {
      tournament: { name: tournament.name, id: tournament.id },
      layerIndex,
      game,
    };
  }

  #getStartingBracketFromPlayerOrder(playerOrder: string[]): Bracket {
    const bracket: Bracket = [];

    playerOrder.forEach((player, playerIndex, players) => {
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

  #getRelevantGames(startTime: number, skipped: TournamentDB["skippedGames"]) {
    type BaseEntry = { time: number; player1: string; player2: string };
    const entries: (
      | (BaseEntry & { game: Game; skip: undefined })
      | (BaseEntry & { game: undefined; skip: TournamentDB["skippedGames"][number] })
    )[] = [];

    const games = this.parent.games.filter((game) => game?.time > startTime);
    games.forEach((game) =>
      entries.push({ time: game.time, player1: game.winner, player2: game.loser, game, skip: undefined }),
    );
    skipped
      .filter((s) => s.time > startTime)
      .forEach((skip) =>
        entries.push({ time: skip.time, player1: skip.advancing, player2: skip.eliminated, game: undefined, skip }),
      );

    entries.sort((a, b) => a.time - b.time);
    return entries;
  }

  #fillBracketWithGames(bracket: Bracket, startTime: number, skipped: TournamentDB["skippedGames"]) {
    const entries = this.#getRelevantGames(startTime, skipped);

    entries.forEach((entry) => {
      // eslint-disable-next-line no-loop-func
      bracket.forEach((layer, layerIndex) =>
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
          const nextMatch = bracket[match.advanceTo.layerIndex][match.advanceTo.gameIndex];
          if (!nextMatch) throw new Error("Next match does not exist");
          if (nextMatch.player1 && nextMatch.player2) throw new Error("Next match already full");
          nextMatch[match.advanceTo.role] = match.winner;
        }),
      );
    });
  }

  #fillGroupsWithGames(
    groupGames: Partial<GroupGame>[][],
    startTime: number,
    skipped: TournamentDB["skippedGames"],
  ): void {
    const entries = this.#getRelevantGames(startTime, skipped);
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

  #getGroupScores(groups: string[][], groupGames: Partial<GroupGame>[][], playerOrder: string[]): GroupScore {
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
          playerOrderIndex: playerOrder.findIndex((p) => p === player),
        }),
      ),
    );

    groupGames.forEach((group) =>
      group.forEach((game) => {
        if (game.winner === undefined) return;
        // Winner
        const winner = scores.get(game.winner)!;
        winner.wins++;
        winner.score += Tournaments.GROUP_POINTS.WIN;
        winner.adjustedScore += Tournaments.GROUP_POINTS.WIN * winner.groupSizeAdjustmentFactor;

        // Loser
        const loserName = [game.player1!, game.player2!].filter((player) => player !== game.winner)[0];
        const loser = scores.get(loserName)!;
        if (game.skipped) {
          loser.dnf++;
          loser.score += Tournaments.GROUP_POINTS.DNF;
          loser.adjustedScore += Tournaments.GROUP_POINTS.DNF * loser.groupSizeAdjustmentFactor;
        } else {
          loser.loss++;
          loser.score += Tournaments.GROUP_POINTS.LOSS;
          loser.adjustedScore += Tournaments.GROUP_POINTS.LOSS * loser.groupSizeAdjustmentFactor;
        }
      }),
    );
    return scores;
  }

  static sortGroupScores([_, p1]: [string, GroupScorePlayer], [__, p2]: [string, GroupScorePlayer]): number {
    if (p1.adjustedScore !== p2.adjustedScore) {
      return p2.adjustedScore - p1.adjustedScore;
    }
    if (p1.wins !== p2.wins) {
      return p2.wins - p1.wins;
    }
    if (p1.loss !== p2.loss) {
      return p1.loss - p2.loss; // Reversed because fewer loss is better
    }
    if (p1.dnf !== p2.dnf) {
      return p1.dnf - p2.dnf; // Reversed because fewer dnf is better
    }
    if (p1.score !== p2.score) {
      return p2.score - p1.score;
    }

    return p1.playerOrderIndex - p2.playerOrderIndex; // Default to player order
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

  #divideInGroups(players: string[]): string[][] {
    const groupSizes = this.#getGroupSizes(players.length);
    // Remove test when verified
    if (players.length !== groupSizes.reduce((a, c) => (a = a + c), 0)) {
      throw new Error("Group sizes do not equal player length");
    }

    const groups: string[][] = [];
    for (let i = 0; i < groupSizes.length; ++i) groups[i] = [];

    for (let i = 0; i < players.length; i++) {
      groups[i % groups.length].push(players[i]);
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
}

/**
 * TODOS:
 * - Store skips in db, page to register skip
 */

/**
 * Ideas:
 * - Tournament results in player page
 */
