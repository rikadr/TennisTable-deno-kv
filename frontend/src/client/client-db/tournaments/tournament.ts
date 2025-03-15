import { ONE_WEEK } from "../../../common/time-in-ms";
import { Game, SignUpTournament, TournamentDB } from "../types";
import { TournamentBracket } from "./bracket";
import { TournamentGroupPlay } from "./group-play";

export type TournamentGame = {
  player1: string;
  player2: string;
  winner?: string;
  skipped?: TournamentDB["skippedGames"][number];
  completedAt: number;
  /** The nex game the winner will advance to */
  advanceTo?: { layerIndex: number; gameIndex: number; role: "player1" | "player2" };
};

export class Tournament {
  readonly tournamentDb: TournamentDB;
  readonly #games: Game[];
  readonly signedUp: SignUpTournament[];
  groupPlay?: TournamentGroupPlay;
  bracket?: TournamentBracket;

  static readonly GROUP_POINTS = { WIN: 3, LOSS: 1, DNF: 1 } as const;

  private static readonly RECENT_WINNER_THRESHOLD = 2 * ONE_WEEK;
  private static readonly SIGNUP_PERIOD = 2 * ONE_WEEK;

  constructor(tournamentDb: TournamentDB, games: Game[], signedUp: SignUpTournament[]) {
    this.tournamentDb = tournamentDb;
    this.#games = games;
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
}
