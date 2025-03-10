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

  static GROUP_POINTS = { WIN: 3, LOSS: 1, DNF: 1 } as const;

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
