import { ONE_WEEK } from "../../../common/time-in-ms";
import { Game } from "../event-store/projectors/games-projector";
import { SignUp, SkippedGame } from "../event-store/projectors/tournaments-projector";
import { TournamentDB } from "../types";
import { TournamentBracket } from "./bracket";
import { TournamentGroupPlay } from "./group-play";

export type TournamentGame = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: SkippedGame;
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: { layerIndex: number; gameIndex: number; role: "player1" | "player2" };
};

export class Tournament {
  readonly tournamentDb: TournamentDB;
  readonly #games: Game[];
  readonly #skippedGames: SkippedGame[];
  readonly signedUp: SignUp[];
  groupPlay?: TournamentGroupPlay;
  bracket?: TournamentBracket;

  static readonly GROUP_POINTS = { WIN: 3, LOSS: 1, SKIP: 0 } as const;

  private static readonly RECENT_WINNER_THRESHOLD = 2 * ONE_WEEK;
  private static readonly SIGNUP_PERIOD = 2 * ONE_WEEK;

  constructor(tournamentDb: TournamentDB, games: Game[], skippedGames: SkippedGame[], signedUp: SignUp[]) {
    this.tournamentDb = tournamentDb;
    this.#games = games;
    this.#skippedGames = skippedGames;
    this.signedUp = signedUp;

    if (this.tournamentDb.startDate > Date.now()) {
      return; // Not started. No need to calculate bracket or group play
    }
    if (this.tournamentDb.groupPlay) {
      this.groupPlay = new TournamentGroupPlay(this);
    }
    if (
      this.tournamentDb.groupPlay === false || // No group play
      this.groupPlay === undefined || // Group play is not calculated
      this.groupPlay.groupPlayEnded !== undefined // Group play has ended
    ) {
      this.bracket = new TournamentBracket(this);
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

  get recentWinner(): string | undefined {
    if (this.startDate > Date.now()) return undefined; // Has not started
    if (this.endDate === undefined) return undefined; // Has not ended
    if (this.winner === undefined) return undefined; // Has no winner
    if (Date.now() - this.endDate > Tournament.RECENT_WINNER_THRESHOLD) return undefined; // Not recent
    return this.winner;
  }

  get inSignupPeriod(): boolean {
    if (this.startDate < Date.now()) return false; // Has started
    if (this.startDate - Tournament.SIGNUP_PERIOD > Date.now()) return false; // Not yet in signup period
    return true;
  }

  get hasPendingGames(): boolean {
    if (this.startDate > Date.now()) return false; // Not started
    if (this.endDate !== undefined) return false; // Has ended

    // Check group play
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      return this.groupPlay.groups.some((group) => group.pending.length > 0);
    }

    // Check bracket
    return this.bracket!.bracketGames.some((layer) => layer.pending.length > 0);
  }

  /** Used by bracket and group play to get the relevant games and skips */
  getRelevantGames(startTime: number) {
    type BaseEntry = { time: number; player1: string; player2: string };
    const entries: (
      | (BaseEntry & { game: Game; skip: undefined })
      | (BaseEntry & { game: undefined; skip: SkippedGame })
    )[] = [];

    this.#games
      .filter((game) => game?.playedAt > startTime)
      .forEach((game) =>
        entries.push({ time: game.playedAt, player1: game.winner, player2: game.loser, game, skip: undefined }),
      );

    this.#skippedGames
      .filter((s) => s.time > startTime)
      .forEach((skip) =>
        entries.push({ time: skip.time, player1: skip.winner, player2: skip.loser, game: undefined, skip }),
      );

    entries.sort((a, b) => a.time - b.time); // Might be heavy sorting, but we need to be sure the games are in order
    return entries;
  }

  findPendingGame(
    player1: string,
    player2: string,
  ):
    | {
        tournament: { name: string; id: string };
        player1: string;
        player2: string;
        groupIndex?: number;
        layerIndex?: number;
      }
    | undefined {
    if (this.startDate > Date.now()) return; // Not started
    if (this.endDate !== undefined) return; // Has ended

    const players = [player1, player2];

    // Check group play games
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      const pendingGroupIndex = this.groupPlay.groups.findIndex((group) =>
        group.pending.some((game) => players.includes(game.player1!) && players.includes(game.player2!)),
      );
      const pendingGame = this.groupPlay.groups[pendingGroupIndex]?.pending.find(
        (game) => players.includes(game.player1!) && players.includes(game.player2!),
      );
      if (pendingGame) {
        return {
          tournament: { name: this.name, id: this.id },
          player1: pendingGame.player1!,
          player2: pendingGame.player2!,
          groupIndex: pendingGroupIndex,
        };
      }
    }
    if (!this.bracket) return;

    // Check bracket games
    const pendingLayerIndex = this.bracket!.bracketGames.findIndex((layer) =>
      layer.pending.some((game) => players.includes(game.player1!) && players.includes(game.player2!)),
    );
    const pendingGame = this.bracket?.bracketGames[pendingLayerIndex]?.pending.find(
      (game) => players.includes(game.player1!) && players.includes(game.player2!),
    );
    if (pendingGame) {
      return {
        tournament: { name: this.name, id: this.id },
        player1: pendingGame.player1!,
        player2: pendingGame.player2!,
        layerIndex: pendingLayerIndex,
      };
    }
  }

  findPendingGamesByPlayer(player: string):
    | {
        tournament: { name: string; id: string };
        games: { oponent: string; player1: string; player2: string }[];
      }
    | undefined {
    if (this.startDate > Date.now()) return; // Not started
    if (this.endDate !== undefined) return; // Has ended

    const games: { oponent: string; player1: string; player2: string }[] = [];

    // Check group play games
    this.groupPlay?.groups.forEach((group) => {
      group.pending.forEach((game) => {
        if (game.player1 === player || game.player2 === player) {
          games.push({
            oponent: game.player1 === player ? game.player2! : game.player1!,
            player1: game.player1!,
            player2: game.player2!,
          });
        }
      });
    });

    // Check bracket games
    this.bracket?.bracketGames.forEach((layer) => {
      layer.pending.forEach((game) => {
        if (game.player1 === player || game.player2 === player) {
          games.push({
            oponent: game.player1 === player ? game.player2! : game.player1!,
            player1: game.player1!,
            player2: game.player2!,
          });
        }
      });
    });

    if (games.length === 0) return;
    return {
      tournament: { name: this.name, id: this.id },
      games,
    };
  }

  /**
   * Find all pending games in the tournament
   * @returns Array of pending games with player IDs and location info (groupIndex or layerIndex)
   */
  findAllPendingGames(): {
    player1: string;
    player2: string;
  }[] {
    if (this.startDate > Date.now()) return []; // Not started
    if (this.endDate !== undefined) return []; // Has ended

    const games: {
      player1: string;
      player2: string;
    }[] = [];

    // Check group play games
    if (this.groupPlay && this.groupPlay.groupPlayEnded === undefined) {
      this.groupPlay.groups.forEach((group) => {
        group.pending.forEach((game) => {
          games.push({
            player1: game.player1!,
            player2: game.player2!,
          });
        });
      });
    }

    // Check bracket games
    this.bracket?.bracketGames.forEach((layer) => {
      layer.pending.forEach((game) => {
        games.push({
          player1: game.player1!,
          player2: game.player2!,
        });
      });
    });

    return games;
  }

  findAllCompletedGameTimes(): number[] {
    const times: number[] = [];
    if (this.groupPlay) {
      for (const group of this.groupPlay.groups) {
        for (const groupGame of group.groupGames) {
          groupGame.completedAt && times.push(groupGame.completedAt);
        }
      }
    }
    if (this.bracket) {
      for (const layer of this.bracket.bracketGames) {
        for (const game of layer.played) {
          times.push(game.completedAt);
        }
      }
    }
    times.sort((a, b) => a - b);
    return times;
  }
}
